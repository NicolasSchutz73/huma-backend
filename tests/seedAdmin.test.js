const test = require('node:test');
const assert = require('node:assert');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';

const db = require('../src/db/query');
const organizationRepository = require('../src/repositories/organizationRepository');
const userRepository = require('../src/repositories/userRepository');
const { seedDevelopmentData } = require('../src/db/seed');

const originalNodeEnv = process.env.NODE_ENV;
const originalDb = {
  get: db.get,
  run: db.run
};
const originalOrganizationRepository = {
  getAnyOrganizationId: organizationRepository.getAnyOrganizationId,
  createIfNotExists: organizationRepository.createIfNotExists
};
const originalUserRepository = {
  createIfNotExists: userRepository.createIfNotExists
};

test.afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  db.get = originalDb.get;
  db.run = originalDb.run;
  organizationRepository.getAnyOrganizationId = originalOrganizationRepository.getAnyOrganizationId;
  organizationRepository.createIfNotExists = originalOrganizationRepository.createIfNotExists;
  userRepository.createIfNotExists = originalUserRepository.createIfNotExists;
});

test('seedDevelopmentData creates exploitable dataset in development', async () => {
  process.env.NODE_ENV = 'development';

  organizationRepository.getAnyOrganizationId = async () => null;
  organizationRepository.createIfNotExists = async ({ id, name }) => ({ organization: { id, name }, created: true });

  let userCalls = 0;
  userRepository.createIfNotExists = async ({ email, role, organizationId }) => {
    userCalls += 1;
    return {
      user: {
        id: `${role}-${email}`,
        email,
        role,
        organization_id: organizationId
      },
      created: true
    };
  };

  db.get = async (sql) => {
    if (sql.includes('FROM teams')) return null;
    if (sql.includes('FROM check_ins')) return null;
    if (sql.includes('FROM feedbacks')) return null;
    return null;
  };
  db.run = async () => ({ rowCount: 1 });

  const result = await seedDevelopmentData();
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(result.credentials.password, 'adminadmin');
  assert.strictEqual(userCalls, 23); // 1 admin + 2 managers + 20 employees
  assert.strictEqual(result.users.created, 23);
  assert.strictEqual(result.teams.created, 2);
  assert.ok(result.checkins.created > 0);
  assert.ok(result.feedbacks.created > 0);
});

test('seedDevelopmentData is idempotent for already seeded dataset', async () => {
  process.env.NODE_ENV = 'development';

  organizationRepository.getAnyOrganizationId = async () => 'org-1';
  organizationRepository.createIfNotExists = async () => {
    throw new Error('Should not create org when one exists');
  };
  userRepository.createIfNotExists = async ({ email, role, organizationId }) => ({
    user: {
      id: `${role}-${email}`,
      email,
      role,
      organization_id: organizationId
    },
    created: false
  });

  db.get = async (sql, params) => {
    if (sql.includes('FROM teams')) {
      return { id: `team-${params[1]}`, organization_id: params[0], name: params[1] };
    }
    if (sql.includes('FROM check_ins')) return { id: 'existing-checkin' };
    if (sql.includes('FROM feedbacks')) return { id: 'existing-feedback' };
    return null;
  };
  db.run = async () => ({ rowCount: 0 });

  const result = await seedDevelopmentData();
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(result.users.created, 0);
  assert.strictEqual(result.teams.created, 0);
  assert.strictEqual(result.checkins.created, 0);
  assert.strictEqual(result.feedbacks.created, 0);
});

test('seedDevelopmentData is skipped outside development', async () => {
  process.env.NODE_ENV = 'test';

  let calls = 0;
  organizationRepository.getAnyOrganizationId = async () => {
    calls += 1;
    return null;
  };
  userRepository.createIfNotExists = async () => {
    calls += 1;
    return { created: false };
  };
  db.get = async () => {
    calls += 1;
    return null;
  };
  db.run = async () => {
    calls += 1;
    return { rowCount: 0 };
  };

  const result = await seedDevelopmentData();
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(calls, 0);
});
