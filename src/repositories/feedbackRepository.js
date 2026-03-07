const db = require('../db/query');
const { Feedback } = require('../models/feedback');
const { AppError } = require('../utils/errors');

const validateRow = (schema, row) => {
  if (!row) return row;
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new AppError('Database row validation failed', 500, 'DATA_INTEGRITY_ERROR');
  }
  return row;
};

const listByUserId = async (userId) => {
  const sql = `
    SELECT id, category, DATE(created_at) as date, status, feedback_text, is_anonymous
    FROM feedbacks
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;
  const rows = await db.all(sql, [userId]);
  rows.forEach((row) => {
    validateRow(
      Feedback.pick({
        id: true,
        category: true,
        status: true,
        feedback_text: true,
        is_anonymous: true
      }),
      row
    );
  });
  return rows;
};

const createFeedback = async ({ id, userId, category, feedbackText, solutionText, isAnonymous }) => {
  const sql = `
    INSERT INTO feedbacks (id, user_id, category, feedback_text, solution_text, is_anonymous)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  await db.run(sql, [id, userId, category, feedbackText, solutionText, isAnonymous]);
};

const getWeeklyCategoryCountsByTeam = async (teamId, startDate, endDate) => {
  const sql = `
    SELECT f.category, COUNT(*)::int as count
    FROM feedbacks f
    INNER JOIN team_members tm ON tm.user_id = f.user_id
    WHERE tm.team_id = $1
      AND DATE(f.created_at AT TIME ZONE 'UTC') BETWEEN $2::date AND $3::date
    GROUP BY f.category
    ORDER BY COUNT(*) DESC, f.category ASC
  `;
  const rows = await db.all(sql, [teamId, startDate, endDate]);
  rows.forEach((row) => {
    validateRow(Feedback.pick({ category: true }), row);
  });
  return rows;
};

module.exports = {
  listByUserId,
  createFeedback,
  getWeeklyCategoryCountsByTeam
};
