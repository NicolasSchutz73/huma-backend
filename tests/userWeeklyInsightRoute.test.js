const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const dbQuery = require('../src/db/query');
const userService = require('../src/services/userService');
const userRouter = require('../src/routes/user_routes');

const originalDbQuery = {
  get: dbQuery.get
};
const originalUserService = {
  getWeeklyInsight: userService.getWeeklyInsight
};

const createToken = () => jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET);

const getWeeklyInsightHandlers = () => {
  const layer = userRouter.stack.find(
    (entry) => entry.route && entry.route.path === '/me/weekly-insight' && entry.route.methods.get
  );
  return layer.route.stack.map((entry) => entry.handle);
};

const createReq = ({ headers = {}, query = {} } = {}) => ({
  method: 'GET',
  url: '/me/weekly-insight',
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
  userService.getWeeklyInsight = originalUserService.getWeeklyInsight;
});

test('GET /users/me/weekly-insight requires authentication', async () => {
  const handlers = getWeeklyInsightHandlers();
  const req = createReq();
  const res = createRes();

  await assert.rejects(
    runHandlers(handlers, req, res),
    (err) => err.status === 401 && err.code === 'UNAUTHORIZED'
  );
});

test('GET /users/me/weekly-insight validates weekStart format', async () => {
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

test('GET /users/me/weekly-insight returns the expected contract', async () => {
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
  userService.getWeeklyInsight = async () => ({
    weekStart: '2026-02-16',
    weekEnd: '2026-02-20',
    generated: true,
    summaryText: 'Ta semaine reste bien équilibrée.',
    metrics: {
      averageMood: 8,
      participation: 4,
      participationRate: 80,
      topCauses: ['WORKLOAD', 'RECOGNITION'],
      feedbackCategories: {
        ORGANIZATION: 1
      },
      daily: [
        {
          date: '2026-02-16',
          moodValue: 7.8,
          label: 'Jour excellent'
        }
      ]
    }
  });

  await runHandlers(handlers, req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.generated, true);
  assert.strictEqual(res.body.summaryText, 'Ta semaine reste bien équilibrée.');
  assert.strictEqual(res.body.metrics.participationRate, 80);
  assert.deepStrictEqual(res.body.metrics.feedbackCategories, {
    ORGANIZATION: 1
  });
});
