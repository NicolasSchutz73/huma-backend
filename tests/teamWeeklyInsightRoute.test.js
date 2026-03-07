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
  getWeeklyInsight: teamService.getWeeklyInsight
};

const createToken = () => jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET);

const getWeeklyInsightHandlers = () => {
  const layer = teamRouter.stack.find(
    (entry) => entry.route && entry.route.path === '/weekly-insight' && entry.route.methods.get
  );
  return layer.route.stack.map((entry) => entry.handle);
};

const createReq = ({ headers = {}, query = {} } = {}) => ({
  method: 'GET',
  url: '/weekly-insight',
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
  teamService.getWeeklyInsight = originalTeamService.getWeeklyInsight;
});

test('GET /team/weekly-insight requires authentication', async () => {
  const handlers = getWeeklyInsightHandlers();
  const req = createReq();
  const res = createRes();

  await assert.rejects(
    runHandlers(handlers, req, res),
    (err) => err.status === 401 && err.code === 'UNAUTHORIZED'
  );
});

test('GET /team/weekly-insight validates weekStart format', async () => {
  const handlers = getWeeklyInsightHandlers();
  const req = createReq({
    headers: {
      authorization: `Bearer ${createToken()}`
    },
    query: {
      weekStart: '2026-2-16'
    }
  });
  const res = createRes();
  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1' });

  await assert.rejects(
    runHandlers(handlers, req, res),
    (err) => err.status === 400 && err.code === 'VALIDATION_ERROR'
  );
});

test('GET /team/weekly-insight returns the expected contract', async () => {
  const handlers = getWeeklyInsightHandlers();
  const req = createReq({
    headers: {
      authorization: `Bearer ${createToken()}`
    },
    query: {
      weekStart: '2026-02-16'
    }
  });
  const res = createRes();
  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1' });
  teamService.getWeeklyInsight = async () => ({
    weekStart: '2026-02-16',
    weekEnd: '2026-02-20',
    teamId: 'team-1',
    generated: true,
    summaryText: 'Synthèse générée',
    metrics: {
      averageMood: 7.2,
      participation: 4,
      participationRate: 80,
      topCauses: ['WORKLOAD', 'RECOGNITION'],
      feedbackCategories: {
        ORGANIZATION: 2,
        RECOGNITION: 1
      },
      daily: [
        {
          date: '2026-02-16',
          moodValue: 7.4,
          label: 'Jour excellent'
        }
      ]
    }
  });

  await runHandlers(handlers, req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.generated, true);
  assert.strictEqual(res.body.summaryText, 'Synthèse générée');
  assert.strictEqual(res.body.metrics.participationRate, 80);
  assert.deepStrictEqual(res.body.metrics.feedbackCategories, {
    ORGANIZATION: 2,
    RECOGNITION: 1
  });
});
