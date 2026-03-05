const test = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const organizationRepository = require('../src/repositories/organizationRepository');
const userRepository = require('../src/repositories/userRepository');
const { AppError } = require('../src/utils/errors');

const loadAuthService = () => {
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/services/authService')];
  return require('../src/services/authService');
};

const originalOrganizationRepository = {
  getAnyOrganizationId: organizationRepository.getAnyOrganizationId,
  createOrganization: organizationRepository.createOrganization
};
const originalUserRepository = {
  createUser: userRepository.createUser,
  getByEmail: userRepository.getByEmail
};

test.afterEach(() => {
  organizationRepository.getAnyOrganizationId = originalOrganizationRepository.getAnyOrganizationId;
  organizationRepository.createOrganization = originalOrganizationRepository.createOrganization;
  userRepository.createUser = originalUserRepository.createUser;
  userRepository.getByEmail = originalUserRepository.getByEmail;
});

test('register hashes password and creates employee user', async () => {
  const authService = loadAuthService();
  organizationRepository.getAnyOrganizationId = async () => 'org-1';
  userRepository.createUser = async ({ email, role, passwordHash }) => {
    assert.strictEqual(email, 'new.user@local.test');
    assert.strictEqual(role, 'employee');
    assert.ok(passwordHash);
    assert.notStrictEqual(passwordHash, 'adminadmin');
  };

  const result = await authService.register({
    email: 'new.user@local.test',
    password: 'adminadmin'
  });

  assert.strictEqual(result.user.email, 'new.user@local.test');
  assert.strictEqual(result.user.role, 'employee');
  assert.ok(result.token);
});

test('register rejects short password', async () => {
  const authService = loadAuthService();
  await assert.rejects(
    authService.register({ email: 'new.user@local.test', password: 'short' }),
    (err) => err instanceof AppError && err.status === 400 && err.code === 'VALIDATION_ERROR'
  );
});

test('login rejects legacy account without password hash', async () => {
  const authService = loadAuthService();
  userRepository.getByEmail = async () => ({
    id: 'user-1',
    email: 'legacy@local.test',
    role: 'employee',
    organization_id: 'org-1',
    password_hash: null
  });

  await assert.rejects(
    authService.login({ email: 'legacy@local.test', password: 'adminadmin' }),
    (err) => err instanceof AppError && err.status === 401 && err.code === 'UNAUTHORIZED'
  );
});

test('login rejects invalid password', async () => {
  const authService = loadAuthService();
  const validHash = await bcrypt.hash('validpass123', 10);
  userRepository.getByEmail = async () => ({
    id: 'user-1',
    email: 'user@local.test',
    role: 'employee',
    organization_id: 'org-1',
    password_hash: validHash
  });

  await assert.rejects(
    authService.login({ email: 'user@local.test', password: 'adminadmin' }),
    (err) => err instanceof AppError && err.status === 401 && err.code === 'UNAUTHORIZED'
  );
});

test('login succeeds with valid password', async () => {
  const authService = loadAuthService();
  const validHash = await bcrypt.hash('adminadmin', 10);
  userRepository.getByEmail = async () => ({
    id: 'user-1',
    email: 'user@local.test',
    role: 'employee',
    first_name: 'User',
    last_name: 'Local',
    onboarding_completed: false,
    organization_id: 'org-1',
    password_hash: validHash
  });

  const result = await authService.login({ email: 'user@local.test', password: 'adminadmin' });
  assert.ok(result.token);
  assert.strictEqual(result.user.email, 'user@local.test');
});
