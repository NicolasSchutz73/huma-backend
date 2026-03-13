const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const dbQuery = require('../src/db/query');
const teamService = require('../src/services/teamService');
const teamRouter = require('../src/routes/team');

const originalDbQuery = {
  get: dbQuery.get
};
const originalTeamService = {
  getWeeklyAnalysisReport: teamService.getWeeklyAnalysisReport
};

const createToken = () => jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET);

const getHandlers = (path) => {
  const layer = teamRouter.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods.get
  );
  return layer.route.stack.map((entry) => entry.handle);
};

const createReq = ({ headers = {}, query = {}, url = '/weekly-analysis-report' } = {}) => ({
  method: 'GET',
  url,
  headers,
  query,
  params: {},
  body: {}
});

const createRes = () => ({
  statusCode: 200,
  headers: {},
  body: undefined,
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  }
});

const runHandlers = async (handlers, req, res) => {
  for (const handler of handlers) {
    await new Promise((resolve, reject) => {
      let nextCalled = false;
      const next = (err) => {
        nextCalled = true;
        if (err) reject(err);
        else resolve();
      };

      Promise.resolve(handler(req, res, next))
        .then(() => {
          if (!nextCalled) resolve();
        })
        .catch(reject);
    });
  }
};

test.afterEach(() => {
  dbQuery.get = originalDbQuery.get;
  teamService.getWeeklyAnalysisReport = originalTeamService.getWeeklyAnalysisReport;
});

test('GET /team/weekly-analysis-report requires authentication', async () => {
  const handlers = getHandlers('/weekly-analysis-report');
  await assert.rejects(
    runHandlers(handlers, createReq(), createRes()),
    (err) => err.status === 401 && err.code === 'UNAUTHORIZED'
  );
});

test('GET /team/weekly-analysis-report validates weekStart format', async () => {
  const handlers = getHandlers('/weekly-analysis-report');
  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'manager' });

  await assert.rejects(
    runHandlers(
      handlers,
      createReq({
        headers: { authorization: `Bearer ${createToken()}` },
        query: { weekStart: '2026-2-16' }
      }),
      createRes()
    ),
    (err) => err.status === 400 && err.code === 'VALIDATION_ERROR'
  );
});

test('GET /team/weekly-analysis-report validates forceRegenerate format', async () => {
  const handlers = getHandlers('/weekly-analysis-report');
  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'manager' });

  await assert.rejects(
    runHandlers(
      handlers,
      createReq({
        headers: { authorization: `Bearer ${createToken()}` },
        query: { forceRegenerate: 'yes' }
      }),
      createRes()
    ),
    (err) => err.status === 400 && err.code === 'VALIDATION_ERROR'
  );
});

test('GET /team/weekly-analysis-report returns the expected contract', async () => {
  const handlers = getHandlers('/weekly-analysis-report');
  const res = createRes();
  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'manager' });
  teamService.getWeeklyAnalysisReport = async ({ forceRegenerate }) => {
    assert.strictEqual(forceRegenerate, true);
    return ({
    weekStart: '2026-02-23',
    weekEnd: '2026-02-27',
    teamId: 'team-1',
    generated: true,
    overview: {
      moodBand: 'correcte',
      averageMood: 6.1,
      participationRate: 91,
      trend: 'baisse',
      trendStrength: 'modérée'
    },
    strengths: [{ rank: 1, title: 'Bonne ambiance', weight: 35, description: 'Stable.' }, { rank: 2, title: 'Participation élevée', weight: 30, description: 'Forte.' }, { rank: 3, title: 'Motivation présente', weight: 20, description: 'Visible.' }],
    weaknesses: [
      { rank: 1, title: 'Charge', weight: 30, description: 'Sujet principal.' },
      { rank: 2, title: 'Équilibre', weight: 25, description: 'Tension.' },
      { rank: 3, title: 'Reconnaissance', weight: 20, description: 'Axe secondaire.' },
      { rank: 4, title: 'Clarté', weight: 15, description: 'A clarifier.' },
      { rank: 5, title: 'Fatigue', weight: 10, description: 'Signal léger.' }
    ],
    recommendedActions: [
      { id: 'reduce-workload', title: 'Clarifier et réduire la charge de travail', priority: 'Critique', estimatedImpact: '+35%', summary: 'Réduire la pression.', checklist: ['a'] },
      { id: 'protect-balance', title: "Protéger l'équilibre vie pro / vie perso", priority: 'Élevée', estimatedImpact: '+35%', summary: 'Protéger les temps.', checklist: ['a'] },
      { id: 'recognition-routine', title: 'Mettre en place une reconnaissance régulière', priority: 'Élevée', estimatedImpact: '+25%', summary: 'Valoriser.', checklist: ['a'] },
      { id: 'restore-clarity', title: 'Redonner du sens et de la visibilité', priority: 'Moyenne', estimatedImpact: '+20%', summary: 'Clarifier.', checklist: ['a'] }
    ],
    teamActivities: [
      { id: 'solution-retro', title: "Rétrospective d'équipe orientée solutions", estimatedImpact: '+15%', objective: 'Faire émerger irritants et solutions concrètes', format: 'Atelier collectif (1h-1h30)', bullets: ['a'], benefit: 'Utile.' },
      { id: 'recognition-icebreaker', title: 'Ice breaker Reconnaissance', estimatedImpact: '+10%', objective: 'Renforcer la reconnaissance entre pairs', format: 'Court rituel (15-20min)', bullets: ['a'], benefit: 'Simple.' },
      { id: 'low-pressure-offsite', title: 'Activité hors cadre à faible charge mentale', estimatedImpact: '+20%', objective: 'Décompression sans pression', format: 'Moment informel', bullets: ['a'], benefit: 'Complémentaire.' }
    ],
    reportMeta: {
      fromCache: false,
      generationCount: 1,
      generationLimit: 2,
      canRegenerate: true,
      generatedAt: '2026-02-28T09:00:00.000Z'
    }
  });
  };

  await runHandlers(
    handlers,
    createReq({
      headers: { authorization: `Bearer ${createToken()}` },
      query: { weekStart: '2026-02-23', forceRegenerate: 'true' }
    }),
    res
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.generated, true);
  assert.strictEqual(res.body.overview.moodBand, 'correcte');
  assert.strictEqual(res.body.strengths.length, 3);
  assert.strictEqual(res.body.weaknesses.length, 5);
  assert.strictEqual(res.body.recommendedActions.length, 4);
  assert.strictEqual(res.body.teamActivities.length, 3);
  assert.strictEqual(res.body.reportMeta.generationCount, 1);
  assert.strictEqual(res.body.reportMeta.fromCache, false);
});
