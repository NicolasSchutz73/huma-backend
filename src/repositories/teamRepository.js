const db = require('../db/query');
const { Team } = require('../models/team');
const { TeamMember } = require('../models/teamMember');
const { AppError } = require('../utils/errors');

const validateRow = (schema, row) => {
  if (!row) return row;
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new AppError('Database row validation failed', 500, 'DATA_INTEGRITY_ERROR');
  }
  return row;
};

const getMemberIdsByTeam = async (teamId) => {
  const sql = `
    SELECT user_id FROM team_members
    WHERE team_id = ?
  `;
  const rows = await db.all(sql, [teamId]);
  rows.forEach((row) => validateRow(TeamMember.pick({ user_id: true }), row));
  return rows;
};

const getFirstTeamIdByUser = async (userId) => {
  const sql = `
    SELECT team_id FROM team_members
    WHERE user_id = ?
    LIMIT 1
  `;
  const row = await db.get(sql, [userId]);
  validateRow(TeamMember.pick({ team_id: true }), row);
  return row ? row.team_id : null;
};

const isMember = async (teamId, userId) => {
  const sql = `
    SELECT 1 FROM team_members
    WHERE team_id = ? AND user_id = ?
  `;
  const row = await db.get(sql, [teamId, userId]);
  return !!row;
};

const getTeamById = async (teamId) => {
  const row = await db.get('SELECT id FROM teams WHERE id = ?', [teamId]);
  validateRow(Team.pick({ id: true }), row);
  return row ? row.id : null;
};

const createTeam = async ({ id, organizationId, name }) => {
  const sql = `INSERT INTO teams (id, organization_id, name) VALUES (?, ?, ?)`;
  await db.run(sql, [id, organizationId, name]);
};

const addMember = async ({ id, teamId, userId }) => {
  const sql = `INSERT INTO team_members (id, team_id, user_id) VALUES (?, ?, ?)`;
  await db.run(sql, [id, teamId, userId]);
};

const getTodayStats = async ({ memberIds, today }) => {
  const placeholders = memberIds.map(() => '?').join(',');
  const sql = `
    SELECT AVG(mood_value) as avgMood, COUNT(*) as count
    FROM check_ins
    WHERE user_id IN (${placeholders}) AND date(timestamp) = date(?)
  `;
  return db.get(sql, [...memberIds, today]);
};

const getTodayCauses = async ({ memberIds, today }) => {
  const placeholders = memberIds.map(() => '?').join(',');
  const sql = `
    SELECT causes
    FROM check_ins
    WHERE user_id IN (${placeholders}) AND date(timestamp) = date(?) AND causes IS NOT NULL
  `;
  return db.all(sql, [...memberIds, today]);
};

const getWeeklyTrend = async ({ memberIds }) => {
  const placeholders = memberIds.map(() => '?').join(',');
  const sql = `
    SELECT date(timestamp) as day, AVG(mood_value) as avgMood
    FROM check_ins
    WHERE user_id IN (${placeholders})
      AND timestamp >= date('now', '-7 days')
    GROUP BY date(timestamp)
    ORDER BY date(timestamp) ASC
  `;
  return db.all(sql, memberIds);
};

module.exports = {
  getMemberIdsByTeam,
  getFirstTeamIdByUser,
  isMember,
  getTeamById,
  createTeam,
  addMember,
  getTodayStats,
  getTodayCauses,
  getWeeklyTrend
};
