const db = require('../db/index');
const { TeamWeeklyReport } = require('../models/teamWeeklyReport');
const { AppError } = require('../utils/errors');

const REPORT_TYPE_WEEKLY_ANALYSIS = 'weekly_analysis_report';

const validateRow = (row) => {
  if (!row) return row;
  const result = TeamWeeklyReport.safeParse(row);
  if (!result.success) {
    throw new AppError('Database row validation failed', 500, 'DATA_INTEGRITY_ERROR');
  }
  return row;
};

const mapRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    teamId: row.team_id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    reportType: row.report_type,
    payload: typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json,
    generationCount: row.generation_count,
    generatedAt: row.generated_at,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const getByScope = async ({ teamId, weekStart, reportType = REPORT_TYPE_WEEKLY_ANALYSIS, client = db }) => {
  const row = await client.query(
    `
      SELECT id, team_id, week_start, week_end, report_type, payload_json, generation_count,
             generated_at, created_by_user_id, updated_by_user_id, created_at, updated_at
      FROM team_weekly_reports
      WHERE team_id = $1 AND week_start = $2 AND report_type = $3
    `,
    [teamId, weekStart, reportType]
  );
  const reportRow = row.rows[0] || null;
  validateRow(reportRow);
  return mapRow(reportRow);
};

const getByScopeForUpdate = async ({ teamId, weekStart, reportType = REPORT_TYPE_WEEKLY_ANALYSIS, client }) => {
  const row = await client.query(
    `
      SELECT id, team_id, week_start, week_end, report_type, payload_json, generation_count,
             generated_at, created_by_user_id, updated_by_user_id, created_at, updated_at
      FROM team_weekly_reports
      WHERE team_id = $1 AND week_start = $2 AND report_type = $3
      FOR UPDATE
    `,
    [teamId, weekStart, reportType]
  );
  const reportRow = row.rows[0] || null;
  validateRow(reportRow);
  return mapRow(reportRow);
};

const createReport = async ({
  id,
  teamId,
  weekStart,
  weekEnd,
  payload,
  generationCount,
  generatedAt,
  createdByUserId,
  updatedByUserId,
  reportType = REPORT_TYPE_WEEKLY_ANALYSIS,
  client
}) => {
  await client.query(
    `
      INSERT INTO team_weekly_reports (
        id, team_id, week_start, week_end, report_type, payload_json,
        generation_count, generated_at, created_by_user_id, updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
    `,
    [
      id,
      teamId,
      weekStart,
      weekEnd,
      reportType,
      JSON.stringify(payload),
      generationCount,
      generatedAt,
      createdByUserId,
      updatedByUserId
    ]
  );
};

const updateReport = async ({
  reportId,
  weekEnd,
  payload,
  generationCount,
  generatedAt,
  updatedByUserId,
  client
}) => {
  await client.query(
    `
      UPDATE team_weekly_reports
      SET week_end = $2,
          payload_json = $3::jsonb,
          generation_count = $4,
          generated_at = $5,
          updated_by_user_id = $6,
          updated_at = NOW()
      WHERE id = $1
    `,
    [reportId, weekEnd, JSON.stringify(payload), generationCount, generatedAt, updatedByUserId]
  );
};

module.exports = {
  REPORT_TYPE_WEEKLY_ANALYSIS,
  getByScope,
  getByScopeForUpdate,
  createReport,
  updateReport
};
