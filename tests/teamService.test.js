const test = require('node:test');
const assert = require('node:assert');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';

const teamRepository = require('../src/repositories/teamRepository');
const teamService = require('../src/services/teamService');
const { AppError } = require('../src/utils/errors');

const originalRepository = {
  isMember: teamRepository.isMember,
  getFirstTeamIdByUser: teamRepository.getFirstTeamIdByUser,
  getByDateRange: teamRepository.getByDateRange,
  getByDateRangeWithCauses: teamRepository.getByDateRangeWithCauses
};

test.afterEach(() => {
  teamRepository.isMember = originalRepository.isMember;
  teamRepository.getFirstTeamIdByUser = originalRepository.getFirstTeamIdByUser;
  teamRepository.getByDateRange = originalRepository.getByDateRange;
  teamRepository.getByDateRangeWithCauses = originalRepository.getByDateRangeWithCauses;
});

test('team weekly summary returns empty payload when user has no team', async () => {
  teamRepository.getFirstTeamIdByUser = async () => null;

  const result = await teamService.getWeeklySummary({
    userId: 'user-1',
    period: 'week',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.period, 'week');
  assert.strictEqual(result.participation, 0);
  assert.strictEqual(result.averageMood, null);
  assert.strictEqual(result.daily.length, 5);
  assert.strictEqual(result.stats.excellentDays, 0);
  assert.strictEqual(result.stats.correctDays, 0);
  assert.strictEqual(result.stats.difficultDays, 0);
  assert.strictEqual(result.stats.missingDays, 5);
});

test('team weekly summary rejects with FORBIDDEN when user is not a team member', async () => {
  teamRepository.isMember = async () => false;

  await assert.rejects(
    teamService.getWeeklySummary({
      userId: 'user-1',
      queryTeamId: 'team-1',
      period: 'week',
      date: '2026-02-16'
    }),
    (err) => err instanceof AppError && err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('team weekly summary computes daily participation and average mood', async () => {
  teamRepository.isMember = async () => true;
  teamRepository.getByDateRange = async () => [
    { date: '2026-02-16', moodValue: 70 },
    { date: '2026-02-18', moodValue: 55 }
  ];
  teamRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-02-16', moodValue: 80, causes: '["WORKLOAD"]' },
    { date: '2026-02-16', moodValue: 60, causes: '["BALANCE"]' },
    { date: '2026-02-18', moodValue: 55, causes: '["RELATIONS"]' }
  ];

  const result = await teamService.getWeeklySummary({
    userId: 'user-1',
    queryTeamId: 'team-1',
    period: 'week',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.participation, 2);
  assert.strictEqual(result.averageMood, 6.5);
  assert.strictEqual(result.daily.length, 5);
  assert.strictEqual(result.stats.excellentDays, 1);
  assert.strictEqual(result.stats.correctDays, 1);
  assert.strictEqual(result.stats.missingDays, 3);
});

test('team weekly factors builds buckets and ignores malformed causes', async () => {
  teamRepository.isMember = async () => true;
  teamRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-02-16', moodValue: 80, causes: '["WORKLOAD","BALANCE"]' },
    { date: '2026-02-17', moodValue: 30, causes: '["WORKLOAD"]' },
    { date: '2026-02-18', moodValue: 60, causes: 'invalid-json' }
  ];

  const result = await teamService.getWeeklyFactors({
    userId: 'user-1',
    queryTeamId: 'team-1',
    period: 'week',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.summary.totalCheckins, 3);
  assert.ok(result.availableCauses.includes('WORKLOAD'));
  assert.ok(result.availableCauses.includes('BALANCE'));
  assert.strictEqual(result.byCause.WORKLOAD.totalCheckins, 2);
});

test('team weekly summary validates month date format', async () => {
  await assert.rejects(
    teamService.getWeeklySummary({
      userId: 'user-1',
      period: 'month',
      date: '2026-02-16'
    }),
    (err) => err instanceof AppError && err.status === 400 && err.code === 'VALIDATION_ERROR'
  );
});
