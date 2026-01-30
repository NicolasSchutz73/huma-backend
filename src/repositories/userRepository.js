const db = require('../db/query');
const { User } = require('../models/user');
const { AppError } = require('../utils/errors');

const validateRow = (schema, row) => {
  if (!row) return row;
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new AppError('Database row validation failed', 500, 'DATA_INTEGRITY_ERROR');
  }
  return row;
};

const createUser = async ({ id, email, organizationId, role }) => {
  const sql = `
    INSERT INTO users (id, email, organization_id, role, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
  `;
  await db.run(sql, [id, email, organizationId, role]);
};

const getByEmail = async (email) => {
  const sql = `
    SELECT id, email, role, organization_id, first_name, last_name, onboarding_completed
    FROM users
    WHERE email = $1
  `;
  const row = await db.get(sql, [email]);
  validateRow(
    User.pick({
      id: true,
      email: true,
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

module.exports = {
  createUser,
  getByEmail,
  getById,
  getIdById,
  updateNames,
  updateOnboarding
};
