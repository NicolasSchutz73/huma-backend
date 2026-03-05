const db = require('../db/query');
const { User } = require('../models/user');
const { AppError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

const validateRow = (schema, row) => {
  if (!row) return row;
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new AppError('Database row validation failed', 500, 'DATA_INTEGRITY_ERROR');
  }
  return row;
};

const createUser = async ({ id, email, organizationId, role, passwordHash = null }) => {
  const sql = `
    INSERT INTO users (id, email, password_hash, organization_id, role, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
  `;
  await db.run(sql, [id, email, passwordHash, organizationId, role]);
};

const getByEmail = async (email) => {
  const sql = `
    SELECT id, email, password_hash, role, organization_id, first_name, last_name, onboarding_completed
    FROM users
    WHERE email = $1
  `;
  const row = await db.get(sql, [email]);
  validateRow(
    User.pick({
      id: true,
      email: true,
      password_hash: true,
      role: true,
      organization_id: true,
      first_name: true,
      last_name: true,
      onboarding_completed: true
    }),
    row
  );
  return row;
};

const getById = async (userId) => {
  const sql = `
    SELECT id, email, first_name, last_name, role, organization_id, onboarding_completed, work_style, motivation_type, stress_source
    FROM users
    WHERE id = $1
  `;
  const row = await db.get(sql, [userId]);
  validateRow(
    User.pick({
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      role: true,
      organization_id: true,
      onboarding_completed: true,
      work_style: true,
      motivation_type: true,
      stress_source: true
    }),
    row
  );
  return row;
};

const getIdById = async (userId) => {
  const row = await db.get('SELECT id FROM users WHERE id = $1', [userId]);
  validateRow(User.pick({ id: true }), row);
  return row ? row.id : null;
};

const updateNames = async ({ userId, firstName, lastName }) => {
  const sql = `
    UPDATE users
    SET first_name = $1, last_name = $2, updated_at = NOW()
    WHERE id = $3
  `;
  await db.run(sql, [firstName, lastName, userId]);
};

const updateOnboarding = async ({ userId, workStyle, motivationType, stressSource }) => {
  const sql = `
    UPDATE users
    SET work_style = $1, motivation_type = $2, stress_source = $3, onboarding_completed = TRUE, updated_at = NOW()
    WHERE id = $4
  `;
  await db.run(sql, [workStyle, motivationType, stressSource, userId]);
};

const setPasswordHash = async ({ userId, passwordHash }) => {
  const sql = `
    UPDATE users
    SET password_hash = $1, updated_at = NOW()
    WHERE id = $2
  `;
  await db.run(sql, [passwordHash, userId]);
};

const createIfNotExists = async ({ email, role, organizationId, firstName, lastName, passwordHash = null }) => {
  const existingUser = await getByEmail(email);
  if (existingUser) {
    if (!existingUser.password_hash && passwordHash) {
      await setPasswordHash({ userId: existingUser.id, passwordHash });
      existingUser.password_hash = passwordHash;
    }
    return { user: existingUser, created: false };
  }

  const id = uuidv4();
  const sql = `
    INSERT INTO users (id, email, password_hash, organization_id, role, first_name, last_name, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
  `;
  await db.run(sql, [id, email, passwordHash, organizationId, role, firstName || null, lastName || null]);

  return {
    user: {
      id,
      email,
      password_hash: passwordHash,
      role,
      organization_id: organizationId,
      first_name: firstName || null,
      last_name: lastName || null,
      onboarding_completed: false
    },
    created: true
  };
};

module.exports = {
  createUser,
  createIfNotExists,
  setPasswordHash,
  getByEmail,
  getById,
  getIdById,
  updateNames,
  updateOnboarding
};
