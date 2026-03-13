const test = require('node:test');
const assert = require('node:assert');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';

const teamWeeklyReportRepository = require('../src/repositories/teamWeeklyReportRepository');
const userWeeklyInsightRepository = require('../src/repositories/userWeeklyInsightRepository');

test('team weekly report repository accepts Date objects from pg timestamp columns', async () => {
  const generatedAt = new Date('2026-02-28T09:00:00.000Z');
  const createdAt = new Date('2026-02-28T09:01:00.000Z');
  const updatedAt = new Date('2026-02-28T09:02:00.000Z');

  const report = await teamWeeklyReportRepository.getByScope({
    teamId: 'team-1',
    weekStart: '2026-02-23',
    client: {
      async query() {
        return {
          rows: [{
            id: 'report-1',
            team_id: 'team-1',
            week_start: '2026-02-23',
            week_end: '2026-02-27',
            report_type: 'weekly_analysis_report',
            payload_json: { generated: true },
            generation_count: 1,
            generated_at: generatedAt,
            created_by_user_id: 'user-1',
            updated_by_user_id: 'user-1',
            created_at: createdAt,
            updated_at: updatedAt
          }]
        };
      }
    }
  });

  assert.strictEqual(report.generatedAt, generatedAt.toISOString());
  assert.strictEqual(report.createdAt, createdAt.toISOString());
  assert.strictEqual(report.updatedAt, updatedAt.toISOString());
});

test('user weekly insight repository accepts Date objects from pg timestamp columns', async () => {
  const generatedAt = new Date('2026-02-28T09:00:00.000Z');
  const createdAt = new Date('2026-02-28T09:01:00.000Z');
  const updatedAt = new Date('2026-02-28T09:02:00.000Z');

  const insight = await userWeeklyInsightRepository.getByScope({
    userId: 'user-1',
    weekStart: '2026-02-23',
    client: {
      async query() {
        return {
          rows: [{
            id: 'insight-1',
            user_id: 'user-1',
            week_start: '2026-02-23',
            week_end: '2026-02-27',
            payload_json: { generated: true },
            generated_at: generatedAt,
            created_by_user_id: 'user-1',
            updated_by_user_id: 'user-1',
            created_at: createdAt,
            updated_at: updatedAt
          }]
        };
      }
    }
  });

  assert.strictEqual(insight.generatedAt, generatedAt.toISOString());
  assert.strictEqual(insight.createdAt, createdAt.toISOString());
  assert.strictEqual(insight.updatedAt, updatedAt.toISOString());
});
