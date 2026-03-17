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
  getWeeklySummary: teamService.getWeeklySummary
};

const createToken = () => jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET);

const getHandlers = () => {
  const layer = teamRouter.stack.find(
    (entry) => entry.route && entry.route.path === '/weekly-summary' && entry.route.methods.get
  );
  return layer.route.stack.map((entry) => entry.handle);
};

const createReq = ({ headers = {}, query = {} } = {}) => ({
  method: 'GET',
  url: '/weekly-summary',
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
  teamService.getWeeklySummary = originalTeamService.getWeeklySummary;
});

test('GET /team/weekly-summary returns dashboard stats contract', async () => {
  const handlers = getHandlers();
  const req = createReq({
    headers: {
      authorization: `Bearer ${createToken()}`
    },
    query: {
      weekStart: '2026-02-16'
    }
  });
  const res = createRes();
  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'manager' });
  teamService.getWeeklySummary = async () => ({
    weekStart: '2026-02-16',
    weekEnd: '2026-02-20',
    period: 'week',
    participation: 4,
    averageMood: 7.2,
    daily: [],
    stats: {
      excellentDays: 2,
      correctDays: 2,
      difficultDays: 0,
      missingDays: 1
    },
    dashboard: {
      averageMood: {
        value: 7.2,
        deltaVsPreviousWeek: 0.8
      },
      participation: {
        value: 80,
        deltaVsPreviousWeek: 10
      },
      qvtBarometer: {
        value: 6.4,
        deltaVsPreviousWeek: 0.3,
        label: 'Indice annuel évolutif'
      }
    }
  });

  await runHandlers(handlers, req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.averageMood, 7.2);
  assert.strictEqual(res.body.dashboard.averageMood.deltaVsPreviousWeek, 0.8);
  assert.strictEqual(res.body.dashboard.participation.value, 80);
  assert.strictEqual(res.body.dashboard.qvtBarometer.label, 'Indice annuel évolutif');
});
