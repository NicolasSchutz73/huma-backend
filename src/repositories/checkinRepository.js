const db = require('../db/query');
const { Checkin } = require('../models/checkin');
const { AppError } = require('../utils/errors');

const validateRow = (schema, row) => {
  if (!row) return row;
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new AppError('Database row validation failed', 500, 'DATA_INTEGRITY_ERROR');
  }
  return row;
};

const getByUserAndDate = async (userId, dateStr) => {
  const sql = `
    SELECT id FROM check_ins
    WHERE user_id = $1 AND DATE("timestamp") = DATE($2)
    LIMIT 1
  `;
  const row = await db.get(sql, [userId, dateStr]);
  validateRow(Checkin.pick({ id: true }), row);
  return row;
};

const createCheckin = async ({ id, userId, moodValue, causesJson, comment, timestamp }) => {
  const sql = `
    INSERT INTO check_ins (id, user_id, mood_value, causes, comment, "timestamp")
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  await db.run(sql, [id, userId, moodValue, causesJson, comment || null, timestamp]);
};

const getHistoryByDays = async (userId, days) => {
  const sql = `
    SELECT DATE("timestamp") as date, mood_value::int as "moodValue"
    FROM check_ins
    WHERE user_id = $1 AND "timestamp" >= (NOW() - ($2 * INTERVAL '1 day'))
    ORDER BY "timestamp" DESC
  `;
  const rows = await db.all(sql, [userId, parseInt(days)]);
  rows.forEach((row) => {
    validateRow(Checkin.pick({ mood_value: true }), { mood_value: row.moodValue });
  });
  return rows;
};

const getByDateRange = async (userId, startDate, endDate) => {
  const sql = `
    SELECT DATE("timestamp") as date, mood_value::int as "moodValue"
    FROM check_ins
    WHERE user_id = $1 AND DATE("timestamp") BETWEEN DATE($2) AND DATE($3)
    ORDER BY DATE("timestamp") ASC
  `;
  const rows = await db.all(sql, [userId, startDate, endDate]);
  rows.forEach((row) => {
    validateRow(Checkin.pick({ mood_value: true }), { mood_value: row.moodValue });
  });
  return rows;
};

module.exports = {
  getByUserAndDate,
  createCheckin,
  getHistoryByDays,
  getByDateRange
};
