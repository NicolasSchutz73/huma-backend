const test = require('node:test');
const assert = require('node:assert');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const userService = require('../src/services/userService');
const checkinRepository = require('../src/repositories/checkinRepository');
const feedbackRepository = require('../src/repositories/feedbackRepository');
const groqClient = require('../src/services/groqClient');
const { AppError } = require('../src/utils/errors');

const originalCheckinRepository = {
  getByDateRange: checkinRepository.getByDateRange,
  getByDateRangeWithCauses: checkinRepository.getByDateRangeWithCauses
};
const originalFeedbackRepository = {
  getWeeklyCategoryCountsByUser: feedbackRepository.getWeeklyCategoryCountsByUser
};
const originalGroqClient = {
  generateUserWeeklyInsight: groqClient.generateUserWeeklyInsight
};

test.afterEach(() => {
  checkinRepository.getByDateRange = originalCheckinRepository.getByDateRange;
  checkinRepository.getByDateRangeWithCauses = originalCheckinRepository.getByDateRangeWithCauses;
  feedbackRepository.getWeeklyCategoryCountsByUser = originalFeedbackRepository.getWeeklyCategoryCountsByUser;
  groqClient.generateUserWeeklyInsight = originalGroqClient.generateUserWeeklyInsight;
});

test('user weekly insight returns empty payload when the week has no data', async () => {
  checkinRepository.getByDateRange = async () => [];
  checkinRepository.getByDateRangeWithCauses = async () => [];
  feedbackRepository.getWeeklyCategoryCountsByUser = async () => [];

  const result = await userService.getWeeklyInsight({
    userId: 'user-1',
    weekStart: '2026-02-16'
  });

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

test('user weekly insight aggregates metrics and calls Groq with personal aggregated data only', async () => {
  let groqPayload = null;

  checkinRepository.getByDateRange = async (userId, startDate, endDate) => {
    assert.strictEqual(userId, 'user-1');
    assert.strictEqual(startDate, '2026-02-16');
    assert.strictEqual(endDate, '2026-02-20');
    return [
      { date: '2026-02-16', moodValue: 80 },
      { date: '2026-02-17', moodValue: 76 },
      { date: '2026-02-19', moodValue: 83 },
      { date: '2026-02-20', moodValue: 81 }
    ];
  };
  checkinRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-02-16', moodValue: 80, causes: '["WORKLOAD","BALANCE"]' },
    { date: '2026-02-17', moodValue: 76, causes: '["WORKLOAD"]' },
    { date: '2026-02-19', moodValue: 83, causes: '["RECOGNITION"]' },
    { date: '2026-02-20', moodValue: 81, causes: '["WORKLOAD"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByUser = async () => [
    { category: 'ORGANIZATION', count: 1 },
    { category: 'RECOGNITION', count: 1 }
  ];
  groqClient.generateUserWeeklyInsight = async (payload) => {
    groqPayload = payload;
    return 'Ta semaine montre une dynamique stable avec une humeur moyenne de 8/10 et une participation solide (4 check-ins sur 5). Un léger creux apparaît en milieu de semaine, lié à ta charge et à ton rythme de travail, avant un retour à un climat plus serein. Globalement, les ressentis dominants restent positifs et témoignent d’une semaine plutôt équilibrée.';
  };

  const result = await userService.getWeeklyInsight({
    userId: 'user-1',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.generated, true);
  assert.strictEqual(result.metrics.averageMood, 8);
  assert.strictEqual(result.metrics.participation, 4);
  assert.strictEqual(result.metrics.participationRate, 80);
  assert.deepStrictEqual(result.metrics.topCauses, ['WORKLOAD', 'BALANCE']);
  assert.deepStrictEqual(result.metrics.feedbackCategories, {
    ORGANIZATION: 1,
    RECOGNITION: 1
  });
  assert.strictEqual(result.metrics.daily.length, 5);
  assert.deepStrictEqual(result.metrics.daily[2], {
    date: '2026-02-18',
    moodValue: null,
    label: 'Aucun check-in'
  });
  assert.ok(groqPayload);
  assert.deepStrictEqual(groqPayload.insightContext.topCauseLabels, ['charge de travail', 'équilibre vie pro / vie perso']);
  assert.deepStrictEqual(groqPayload.insightContext.feedbackCategoryLabels, {
    organisation: 1,
    reconnaissance: 1
  });
  assert.strictEqual(groqPayload.insightContext.moodBand, 'positive');
  assert.strictEqual(groqPayload.insightContext.trend, 'stable');
  assert.strictEqual(groqPayload.insightContext.trendStrength, 'modérée');
  assert.strictEqual(groqPayload.metrics.feedbackText, undefined);
  assert.strictEqual(groqPayload.metrics.comment, undefined);
});

test('user weekly insight normalizes a non-monday date to the week range', async () => {
  checkinRepository.getByDateRange = async (_userId, startDate, endDate) => {
    assert.strictEqual(startDate, '2026-02-16');
    assert.strictEqual(endDate, '2026-02-20');
    return [{ date: '2026-02-17', moodValue: 70 }];
  };
  checkinRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-02-17', moodValue: 70, causes: '["WORKLOAD"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByUser = async () => [];
  groqClient.generateUserWeeklyInsight = async () => 'Synthèse générée';

  const result = await userService.getWeeklyInsight({
    userId: 'user-1',
    weekStart: '2026-02-18'
  });

  assert.strictEqual(result.weekStart, '2026-02-16');
  assert.strictEqual(result.weekEnd, '2026-02-20');
});

test('user weekly insight maps Groq failures to AI_GENERATION_FAILED', async () => {
  checkinRepository.getByDateRange = async () => [{ date: '2026-02-16', moodValue: 80 }];
  checkinRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-02-16', moodValue: 80, causes: '["WORKLOAD"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByUser = async () => [];
  groqClient.generateUserWeeklyInsight = async () => {
    throw new AppError('Groq request timed out', 502, 'AI_GENERATION_FAILED');
  };

  await assert.rejects(
    userService.getWeeklyInsight({
      userId: 'user-1',
      weekStart: '2026-02-16'
    }),
    (err) => err instanceof AppError && err.status === 502 && err.code === 'AI_GENERATION_FAILED'
  );
});

test('user weekly insight rejects impossible weekStart dates', async () => {
  await assert.rejects(
    userService.getWeeklyInsight({
      userId: 'user-1',
      weekStart: '2026-13-40'
    }),
    (err) =>
      err instanceof AppError &&
      err.status === 400 &&
      err.code === 'VALIDATION_ERROR' &&
      err.message === 'weekStart must be in YYYY-MM-DD format'
  );
});
