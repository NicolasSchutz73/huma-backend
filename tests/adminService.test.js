const test = require('node:test');
const assert = require('node:assert');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const loadAdminService = () => {
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/services/adminService')];
  return require('../src/services/adminService');
};

const seedModule = require('../src/db/seed');

const originalNodeEnv = process.env.NODE_ENV;
const originalSeedDevelopmentData = seedModule.seedDevelopmentData;

test.afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  seedModule.seedDevelopmentData = originalSeedDevelopmentData;
});

test('runDevelopmentSeed rejects non-admin users', async () => {
  process.env.NODE_ENV = 'development';
  const adminService = loadAdminService();

  await assert.rejects(
    adminService.runDevelopmentSeed({ userRole: 'manager' }),
    (err) => err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('runDevelopmentSeed rejects outside development', async () => {
  process.env.NODE_ENV = 'test';
  const adminService = loadAdminService();

  await assert.rejects(
    adminService.runDevelopmentSeed({ userRole: 'admin' }),
    (err) => err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('runDevelopmentSeed returns seed summary for admin in development', async () => {
  process.env.NODE_ENV = 'development';
  seedModule.seedDevelopmentData = async () => ({
    skipped: false,
    users: { created: 23 }
  });
  const adminService = loadAdminService();

  const result = await adminService.runDevelopmentSeed({ userRole: 'admin' });

  assert.deepStrictEqual(result, {
    skipped: false,
    users: { created: 23 }
  });
});
