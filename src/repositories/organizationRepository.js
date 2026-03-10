const db = require('../db/query');
const { Organization } = require('../models/organization');
const { AppError } = require('../utils/errors');

const validateRow = (schema, row) => {
  if (!row) return row;
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new AppError('Database row validation failed', 500, 'DATA_INTEGRITY_ERROR');
  }
  return row;
};

const getAnyOrganizationId = async () => {
  const row = await db.get('SELECT id FROM organizations LIMIT 1');
  validateRow(Organization.pick({ id: true }), row);
  return row ? row.id : null;
};

const getByName = async (name) => {
  const row = await db.get('SELECT id, name FROM organizations WHERE name = $1 LIMIT 1', [name]);
  validateRow(Organization.pick({ id: true, name: true }), row);
  return row || null;
};

const createOrganization = async (id, name) => {
  await db.run('INSERT INTO organizations (id, name) VALUES ($1, $2)', [id, name]);
};

const createIfNotExists = async ({ id, name }) => {
  const existingOrg = await getByName(name);
  if (existingOrg) {
    return { organization: existingOrg, created: false };
  }
  await createOrganization(id, name);
  return {
    organization: { id, name },
    created: true
  };
};

module.exports = {
  getAnyOrganizationId,
  getByName,
  createOrganization,
  createIfNotExists
};
