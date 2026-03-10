const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const dbQuery = require('../src/db/query');
const feedbackService = require('../src/services/feedbackService');
const feedbackRouter = require('../src/routes/feedbacks');

const originalDbQuery = {
  get: dbQuery.get
};
const originalFeedbackService = {
  listPublicFeedbacks: feedbackService.listPublicFeedbacks,
  getFeedbacks: feedbackService.getFeedbacks,
  updateFeedbackStatus: feedbackService.updateFeedbackStatus
};

const createToken = () => jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET);

const getHandlers = ({ path, method }) => {
  const layer = feedbackRouter.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
  );
  return layer.route.stack.map((entry) => entry.handle);
};

const createReq = ({ method = 'GET', url, headers = {}, params = {}, body = {} } = {}) => ({
  method,
  url,
  headers,
  query: {},
  params,
  body
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
  feedbackService.listPublicFeedbacks = originalFeedbackService.listPublicFeedbacks;
  feedbackService.getFeedbacks = originalFeedbackService.getFeedbacks;
  feedbackService.updateFeedbackStatus = originalFeedbackService.updateFeedbackStatus;
});

test('GET /feedbacks requires authentication', async () => {
  const handlers = getHandlers({ path: '/', method: 'get' });
  const req = createReq({ url: '/' });
  const res = createRes();

  await assert.rejects(
    runHandlers(handlers, req, res),
    (err) => err.status === 401 && err.code === 'UNAUTHORIZED'
  );
});

test('GET /feedbacks returns all anonymized feedbacks for authenticated users', async () => {
  const handlers = getHandlers({ path: '/', method: 'get' });
  const req = createReq({
    url: '/',
    headers: {
      authorization: `Bearer ${createToken()}`
    }
  });
  const res = createRes();

  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'employee' });
  feedbackService.listPublicFeedbacks = async () => ([
    {
      id: 'feedback-1',
      category: 'WORKLOAD',
      date: '2026-03-09',
      status: 'pending',
      feedbackText: 'Charge de travail trop forte',
      solutionText: 'Prioriser les urgences',
      isAnonymous: false
    }
  ]);

  await runHandlers(handlers, req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, [
    {
      id: 'feedback-1',
      category: 'WORKLOAD',
      date: '2026-03-09',
      status: 'pending',
      feedbackText: 'Charge de travail trop forte',
      solutionText: 'Prioriser les urgences',
      isAnonymous: false
    }
  ]);
});

test('GET /feedbacks/mine requires authentication', async () => {
  const handlers = getHandlers({ path: '/mine', method: 'get' });
  const req = createReq({ url: '/mine' });
  const res = createRes();

  await assert.rejects(
    runHandlers(handlers, req, res),
    (err) => err.status === 401 && err.code === 'UNAUTHORIZED'
  );
});

test('GET /feedbacks/mine returns current user history', async () => {
  const handlers = getHandlers({ path: '/mine', method: 'get' });
  const req = createReq({
    url: '/mine',
    headers: {
      authorization: `Bearer ${createToken()}`
    }
  });
  const res = createRes();

  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1' });
  feedbackService.getFeedbacks = async ({ userId }) => {
    assert.strictEqual(userId, 'user-1');
    return [
      {
        id: 'feedback-2',
        category: 'MOTIVATION',
        date: '2026-03-08',
        status: 'vu',
        preview: 'Feedback personnel',
        isAnonymous: true
      }
    ];
  };

  await runHandlers(handlers, req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, [
    {
      id: 'feedback-2',
      category: 'MOTIVATION',
      date: '2026-03-08',
      status: 'vu',
      preview: 'Feedback personnel',
      isAnonymous: true
    }
  ]);
});

test('PATCH /feedbacks/:id/status requires authentication', async () => {
  const handlers = getHandlers({ path: '/:id/status', method: 'patch' });
  const req = createReq({
    method: 'PATCH',
    url: '/feedback-1/status',
    params: { id: 'feedback-1' },
    body: { status: 'vu' }
  });
  const res = createRes();

  await assert.rejects(
    runHandlers(handlers, req, res),
    (err) => err.status === 401 && err.code === 'UNAUTHORIZED'
  );
});

test('PATCH /feedbacks/:id/status validates status value', async () => {
  const handlers = getHandlers({ path: '/:id/status', method: 'patch' });
  const req = createReq({
    method: 'PATCH',
    url: '/feedback-1/status',
    headers: {
      authorization: `Bearer ${createToken()}`
    },
    params: { id: 'feedback-1' },
    body: { status: 'invalid' }
  });
  const res = createRes();

  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'manager' });

  await assert.rejects(
    runHandlers(handlers, req, res),
    (err) => err.status === 400 && err.code === 'VALIDATION_ERROR'
  );
});

test('PATCH /feedbacks/:id/status rejects employee role', async () => {
  const handlers = getHandlers({ path: '/:id/status', method: 'patch' });
  const req = createReq({
    method: 'PATCH',
    url: '/feedback-1/status',
    headers: {
      authorization: `Bearer ${createToken()}`
    },
    params: { id: 'feedback-1' },
    body: { status: 'vu' }
  });
  const res = createRes();

  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'employee' });
  feedbackService.updateFeedbackStatus = async () => {
    throw Object.assign(new Error('forbidden'), { status: 403, code: 'FORBIDDEN' });
  };

  await assert.rejects(
    runHandlers(handlers, req, res),
    (err) => err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('PATCH /feedbacks/:id/status updates feedback status for manager', async () => {
  const handlers = getHandlers({ path: '/:id/status', method: 'patch' });
  const req = createReq({
    method: 'PATCH',
    url: '/feedback-1/status',
    headers: {
      authorization: `Bearer ${createToken()}`
    },
    params: { id: 'feedback-1' },
    body: { status: 'resolu' }
  });
  const res = createRes();

  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'manager' });
  feedbackService.updateFeedbackStatus = async ({ feedbackId, status, userRole }) => {
    assert.strictEqual(feedbackId, 'feedback-1');
    assert.strictEqual(status, 'resolu');
    assert.strictEqual(userRole, 'manager');
    return {
      message: 'Statut du feedback mis à jour',
      feedback: {
        id: 'feedback-1',
        category: 'WORKLOAD',
        date: '2026-03-10',
        status: 'resolu',
        feedbackText: 'Charge de travail trop forte',
        solutionText: 'Prioriser les urgences',
        isAnonymous: true
      }
    };
  };

  await runHandlers(handlers, req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, {
    message: 'Statut du feedback mis à jour',
    feedback: {
      id: 'feedback-1',
      category: 'WORKLOAD',
      date: '2026-03-10',
      status: 'resolu',
      feedbackText: 'Charge de travail trop forte',
      solutionText: 'Prioriser les urgences',
      isAnonymous: true
    }
  });
});
