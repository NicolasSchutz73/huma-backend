const test = require('node:test');
const assert = require('node:assert');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';

const teamRepository = require('../src/repositories/teamRepository');
const feedbackRepository = require('../src/repositories/feedbackRepository');
const groqClient = require('../src/services/groqClient');
const teamService = require('../src/services/teamService');
const { AppError } = require('../src/utils/errors');

const originalRepository = {
  isMember: teamRepository.isMember,
  getFirstTeamIdByUser: teamRepository.getFirstTeamIdByUser,
  getByDateRange: teamRepository.getByDateRange,
  getByDateRangeWithCauses: teamRepository.getByDateRangeWithCauses,
  getMemberIdsByTeam: teamRepository.getMemberIdsByTeam,
  getActiveMemberCountByDateRange: teamRepository.getActiveMemberCountByDateRange
};
const originalFeedbackRepository = {
  getWeeklyCategoryCountsByTeam: feedbackRepository.getWeeklyCategoryCountsByTeam
};
const originalGroqClient = {
  generateTeamWeeklyInsight: groqClient.generateTeamWeeklyInsight
};

test.afterEach(() => {
  teamRepository.isMember = originalRepository.isMember;
  teamRepository.getFirstTeamIdByUser = originalRepository.getFirstTeamIdByUser;
  teamRepository.getByDateRange = originalRepository.getByDateRange;
  teamRepository.getByDateRangeWithCauses = originalRepository.getByDateRangeWithCauses;
  teamRepository.getMemberIdsByTeam = originalRepository.getMemberIdsByTeam;
  teamRepository.getActiveMemberCountByDateRange = originalRepository.getActiveMemberCountByDateRange;
  feedbackRepository.getWeeklyCategoryCountsByTeam = originalFeedbackRepository.getWeeklyCategoryCountsByTeam;
  groqClient.generateTeamWeeklyInsight = originalGroqClient.generateTeamWeeklyInsight;
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

test('team weekly insight returns empty payload when user has no team', async () => {
  teamRepository.getFirstTeamIdByUser = async () => null;

  const result = await teamService.getWeeklyInsight({
    userId: 'user-1',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.teamId, null);
  assert.strictEqual(result.generated, false);
  assert.strictEqual(result.summaryText, null);
  assert.deepStrictEqual(result.metrics, {
    averageMood: null,
    participation: 0,
    participationRate: 0,
    topCauses: [],
    feedbackCategories: {},
    daily: []
  });
});

test('team weekly insight rejects with FORBIDDEN when user is not a team member', async () => {
  teamRepository.isMember = async () => false;

  await assert.rejects(
    teamService.getWeeklyInsight({
      userId: 'user-1',
      queryTeamId: 'team-1',
      weekStart: '2026-02-16'
    }),
    (err) => err instanceof AppError && err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('team weekly insight aggregates metrics and calls Groq with anonymized feedback categories', async () => {
  let groqPayload = null;

  teamRepository.isMember = async () => true;
  teamRepository.getMemberIdsByTeam = async () => [
    { user_id: 'u1' },
    { user_id: 'u2' },
    { user_id: 'u3' },
    { user_id: 'u4' },
    { user_id: 'u5' }
  ];
  teamRepository.getActiveMemberCountByDateRange = async () => 4;
  teamRepository.getByDateRange = async () => [
    { date: '2026-02-16', moodValue: 74 },
    { date: '2026-02-17', moodValue: 68 },
    { date: '2026-02-19', moodValue: 71 }
  ];
  teamRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-02-16', userId: 'u1', moodValue: 74, causes: '["WORKLOAD","RECOGNITION"]' },
    { date: '2026-02-17', userId: 'u2', moodValue: 68, causes: '["WORKLOAD"]' },
    { date: '2026-02-19', userId: 'u3', moodValue: 71, causes: '["ORGANIZATION"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByTeam = async () => [
    { category: 'ORGANIZATION', count: 2 },
    { category: 'RECOGNITION', count: 1 }
  ];
  groqClient.generateTeamWeeklyInsight = async (payload) => {
    groqPayload = payload;
    return 'Synthèse générée';
  };

  const result = await teamService.getWeeklyInsight({
    userId: 'user-1',
    queryTeamId: 'team-1',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.generated, true);
  assert.strictEqual(result.summaryText, 'Synthèse générée');
  assert.strictEqual(result.metrics.averageMood, 7.1);
  assert.strictEqual(result.metrics.participation, 4);
  assert.strictEqual(result.metrics.participationRate, 80);
  assert.deepStrictEqual(result.metrics.topCauses, ['WORKLOAD', 'RECOGNITION']);
  assert.deepStrictEqual(result.metrics.feedbackCategories, {
    ORGANIZATION: 2,
    RECOGNITION: 1
  });
  assert.strictEqual(result.metrics.daily[0].moodValue, 7.4);
  assert.ok(groqPayload);
  assert.deepStrictEqual(groqPayload.metrics.feedbackCategories, {
    ORGANIZATION: 2,
    RECOGNITION: 1
  });
  assert.deepStrictEqual(groqPayload.insightContext.topCauseLabels, ['charge de travail', 'reconnaissance']);
  assert.deepStrictEqual(groqPayload.insightContext.feedbackCategoryLabels, {
    organisation: 2,
    reconnaissance: 1
  });
  assert.strictEqual(groqPayload.insightContext.moodBand, 'correcte');
  assert.strictEqual(groqPayload.insightContext.trend, 'stable');
  assert.strictEqual(groqPayload.insightContext.trendStrength, 'modérée');
  assert.deepStrictEqual(groqPayload.insightContext.lowestDay, {
    date: '2026-02-17',
    moodValue: 6.8
  });
  assert.deepStrictEqual(groqPayload.insightContext.highestDay, {
    date: '2026-02-16',
    moodValue: 7.4
  });
  assert.strictEqual(typeof groqPayload.insightContext.trendSummary, 'string');
  assert.strictEqual(groqPayload.metrics.feedbackText, undefined);
});

test('team weekly insight returns empty metrics when the week has no data', async () => {
  teamRepository.isMember = async () => true;
  teamRepository.getMemberIdsByTeam = async () => [{ user_id: 'u1' }];
  teamRepository.getActiveMemberCountByDateRange = async () => 0;
  teamRepository.getByDateRange = async () => [];
  teamRepository.getByDateRangeWithCauses = async () => [];
  feedbackRepository.getWeeklyCategoryCountsByTeam = async () => [];

  const result = await teamService.getWeeklyInsight({
    userId: 'user-1',
    queryTeamId: 'team-1',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.teamId, 'team-1');
  assert.strictEqual(result.generated, false);
  assert.strictEqual(result.summaryText, null);
  assert.deepStrictEqual(result.metrics.daily, []);
});

test('team weekly insight maps Groq failures to AI_GENERATION_FAILED', async () => {
  teamRepository.isMember = async () => true;
  teamRepository.getMemberIdsByTeam = async () => [{ user_id: 'u1' }];
  teamRepository.getActiveMemberCountByDateRange = async () => 1;
  teamRepository.getByDateRange = async () => [{ date: '2026-02-16', moodValue: 74 }];
  teamRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-02-16', userId: 'u1', moodValue: 74, causes: '["WORKLOAD"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByTeam = async () => [];
  groqClient.generateTeamWeeklyInsight = async () => {
    throw new AppError('Groq request timed out', 502, 'AI_GENERATION_FAILED');
  };

  await assert.rejects(
    teamService.getWeeklyInsight({
      userId: 'user-1',
      queryTeamId: 'team-1',
      weekStart: '2026-02-16'
    }),
    (err) => err instanceof AppError && err.status === 502 && err.code === 'AI_GENERATION_FAILED'
  );
});
