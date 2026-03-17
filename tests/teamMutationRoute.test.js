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
  createTeam: teamService.createTeam,
  addMember: teamService.addMember
};

const createToken = () => jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET);

const getHandlers = ({ path, method }) => {
  const layer = teamRouter.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
  );
  return layer.route.stack.map((entry) => entry.handle);
};

const createReq = ({ method, url, headers = {}, body = {} } = {}) => ({
  method,
  url,
  headers,
  query: {},
  params: {},
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
  teamService.createTeam = originalTeamService.createTeam;
  teamService.addMember = originalTeamService.addMember;
});

test('POST /team rejects employee role', async () => {
  const handlers = getHandlers({ path: '/', method: 'post' });
  const req = createReq({
    method: 'POST',
    url: '/',
    headers: {
      authorization: `Bearer ${createToken()}`
    },
    body: {
      name: 'Equipe C'
    }
  });
  const res = createRes();

  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'employee' });
  teamService.createTeam = async () => {
    throw Object.assign(new Error('forbidden'), { status: 403, code: 'FORBIDDEN' });
  };

  await assert.rejects(
    runHandlers(handlers, req, res),
    (err) => err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('POST /team passes manager role to service and returns 201', async () => {
  const handlers = getHandlers({ path: '/', method: 'post' });
  const req = createReq({
    method: 'POST',
    url: '/',
    headers: {
      authorization: `Bearer ${createToken()}`
    },
    body: {
      name: 'Equipe C'
    }
  });
  const res = createRes();

  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'manager' });
  teamService.createTeam = async ({ name, userOrganizationId, userRole }) => {
    assert.strictEqual(name, 'Equipe C');
    assert.strictEqual(userOrganizationId, 'org-1');
    assert.strictEqual(userRole, 'manager');
    return {
      message: 'Équipe créée avec succès',
      team: {
        id: 'team-1',
        name,
        organizationId: userOrganizationId
      }
    };
  };

  await runHandlers(handlers, req, res);

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.team.id, 'team-1');
});

test('POST /team/members rejects employee role', async () => {
  const handlers = getHandlers({ path: '/members', method: 'post' });
  const req = createReq({
    method: 'POST',
    url: '/members',
    headers: {
      authorization: `Bearer ${createToken()}`
    },
    body: {
      teamId: 'team-1',
      userId: 'user-2'
    }
  });
  const res = createRes();

  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'employee' });
  teamService.addMember = async () => {
    throw Object.assign(new Error('forbidden'), { status: 403, code: 'FORBIDDEN' });
  };

  await assert.rejects(
    runHandlers(handlers, req, res),
    (err) => err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('POST /team/members passes admin role to service and returns 201', async () => {
  const handlers = getHandlers({ path: '/members', method: 'post' });
  const req = createReq({
    method: 'POST',
    url: '/members',
    headers: {
      authorization: `Bearer ${createToken()}`
    },
    body: {
      teamId: 'team-1',
      userId: 'user-2'
    }
  });
  const res = createRes();

  dbQuery.get = async () => ({ id: 'user-1', organization_id: 'org-1', role: 'admin' });
  teamService.addMember = async ({ teamId, userId, userRole }) => {
    assert.strictEqual(teamId, 'team-1');
    assert.strictEqual(userId, 'user-2');
    assert.strictEqual(userRole, 'admin');
    return {
      message: 'Membre ajouté avec succès',
      member: {
        id: 'member-1',
        teamId,
        userId
      }
    };
  };

  await runHandlers(handlers, req, res);

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.member.id, 'member-1');
});
