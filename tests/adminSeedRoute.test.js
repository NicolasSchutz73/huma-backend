const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const dbQuery = require('../src/db/query');
const adminService = require('../src/services/adminService');
const adminRouter = require('../src/routes/admin');

const originalDbQuery = {
  get: dbQuery.get
};
const originalAdminService = {
  runDevelopmentSeed: adminService.runDevelopmentSeed
};

const createToken = () => jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET);

const getHandlers = ({ path, method }) => {
  const layer = adminRouter.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
  );
  return layer.route.stack.map((entry) => entry.handle);
};

const createReq = ({ method = 'POST', url, headers = {} } = {}) => ({
  method,
  url,
  headers,
  query: {},
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
  adminService.runDevelopmentSeed = originalAdminService.runDevelopmentSeed;
});

test('POST /admin/seed requires authentication', async () => {
  const handlers = getHandlers({ path: '/seed', method: 'post' });
  const req = createReq({ url: '/seed' });
  const res = createRes();

  await assert.rejects(
    runHandlers(handlers, req, res),
    (err) => err.status === 401 && err.code === 'UNAUTHORIZED'
  );
});

test('POST /admin/seed returns seed summary for admin', async () => {
  const handlers = getHandlers({ path: '/seed', method: 'post' });
  const req = createReq({
    url: '/seed',
    headers: {
      authorization: `Bearer ${createToken()}`
    }
  });
  const res = createRes();

  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'admin' });
  adminService.runDevelopmentSeed = async ({ userRole }) => {
    assert.strictEqual(userRole, 'admin');
    return {
      skipped: false,
      users: { created: 23 }
    };
  };

  await runHandlers(handlers, req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, {
    skipped: false,
    users: { created: 23 }
  });
});
