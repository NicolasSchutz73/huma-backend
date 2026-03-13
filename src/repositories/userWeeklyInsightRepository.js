const db = require('../db/index');
const { UserWeeklyInsight } = require('../models/userWeeklyInsight');
const { AppError } = require('../utils/errors');

const toIsoString = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const toDateOnly = (value) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value;
};

const validateRow = (row) => {
  if (!row) return row;
  const result = UserWeeklyInsight.safeParse(row);
  if (!result.success) {
    throw new AppError('Database row validation failed', 500, 'DATA_INTEGRITY_ERROR');
  }
  return row;
};

const mapRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    weekStart: toDateOnly(row.week_start),
    weekEnd: toDateOnly(row.week_end),
    payload: typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json,
    generatedAt: toIsoString(row.generated_at),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
};

const getByScope = async ({ userId, weekStart, client = db }) => {
  const row = await client.query(
    `
      SELECT id, user_id, week_start, week_end, payload_json, generated_at,
             created_by_user_id, updated_by_user_id, created_at, updated_at
      FROM user_weekly_insights
      WHERE user_id = $1 AND week_start = $2
    `,
    [userId, weekStart]
  );
  const insightRow = row.rows[0] || null;
  validateRow(insightRow);
  return mapRow(insightRow);
};

const getByScopeForUpdate = async ({ userId, weekStart, client }) => {
  const row = await client.query(
    `
      SELECT id, user_id, week_start, week_end, payload_json, generated_at,
             created_by_user_id, updated_by_user_id, created_at, updated_at
      FROM user_weekly_insights
      WHERE user_id = $1 AND week_start = $2
      FOR UPDATE
    `,
    [userId, weekStart]
  );
  const insightRow = row.rows[0] || null;
  validateRow(insightRow);
  return mapRow(insightRow);
};

const createInsight = async ({
  id,
  userId,
  weekStart,
  weekEnd,
  payload,
  generatedAt,
  createdByUserId,
  updatedByUserId,
  client
}) => {
  await client.query(
    `
      INSERT INTO user_weekly_insights (
        id, user_id, week_start, week_end, payload_json,
        generated_at, created_by_user_id, updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
    `,
    [
      id,
      userId,
      weekStart,
      weekEnd,
      JSON.stringify(payload),
      generatedAt,
      createdByUserId,
      updatedByUserId
    ]
  );
};

module.exports = {
  getByScope,
  getByScopeForUpdate,
  createInsight
};
