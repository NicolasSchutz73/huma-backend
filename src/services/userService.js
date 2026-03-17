const { v4: uuidv4 } = require('uuid');
const userRepository = require('../repositories/userRepository');
const checkinRepository = require('../repositories/checkinRepository');
const feedbackRepository = require('../repositories/feedbackRepository');
const dbPool = require('../db/index');
const userWeeklyInsightRepository = require('../repositories/userWeeklyInsightRepository');
const { AppError } = require('../utils/errors');
const groqClient = require('./groqClient');
const {
  VALID_CAUSES,
  createWeeklyStats,
  getPeriodRange,
  toDateOnly,
  buildDailyForWeek,
  parseCauses
} = require('./checkinPeriodUtils');

const EMPTY_INSIGHT_METRICS = {
  averageMood: null,
  participation: 0,
  participationRate: 0,
  topCauses: [],
  feedbackCategories: {},
  daily: []
};

const CAUSE_LABELS = {
  WORKLOAD: 'charge de travail',
  RELATIONS: 'relations',
  MOTIVATION: 'motivation',
  CLARITY: 'clarté des priorités',
  RECOGNITION: 'reconnaissance',
  BALANCE: 'équilibre vie pro / vie perso'
};

const FEEDBACK_CATEGORY_LABELS = {
  WORKLOAD: 'charge de travail',
  RELATIONS: 'relations',
  MOTIVATION: 'motivation',
  ORGANIZATION: 'organisation',
  RECOGNITION: 'reconnaissance',
  WORK_LIFE_BALANCE: 'équilibre vie pro / vie perso',
  FACILITIES: 'environnement de travail'
};

const assertValidWeekStart = (weekStart) => {
  if (!weekStart) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    throw new AppError('weekStart must be in YYYY-MM-DD format', 400, 'VALIDATION_ERROR');
  }
  const parsedDate = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().split('T')[0] !== weekStart) {
    throw new AppError('weekStart must be in YYYY-MM-DD format', 400, 'VALIDATION_ERROR');
  }
};

const roundToOneDecimal = (value) => Number(value.toFixed(1));

const getMoodBand = (averageMood) => {
  if (averageMood === null || averageMood === undefined) return 'sans donnée exploitable';
  if (averageMood >= 7.5) return 'positive';
  if (averageMood >= 6) return 'correcte';
  if (averageMood >= 4.5) return 'fragile';
  return 'très dégradée';
};

const getTrendStrength = (daily) => {
  const numericDaily = daily.filter((entry) => entry.moodValue !== null && entry.moodValue !== undefined);
  if (numericDaily.length < 2) return 'stable';

  const values = numericDaily.map((entry) => entry.moodValue);
  const amplitude = roundToOneDecimal(Math.max(...values) - Math.min(...values));

  if (amplitude >= 1.2) return 'marquée';
  if (amplitude >= 0.5) return 'modérée';
  return 'faible';
};

const getDailyTrendSummary = (daily) => {
  const numericDaily = daily.filter((entry) => entry.moodValue !== null && entry.moodValue !== undefined);
  if (numericDaily.length < 2) {
    return {
      trend: 'stable',
      strength: 'faible',
      lowestDay: null,
      highestDay: null,
      summary: 'Pas assez de variation pour dégager une tendance nette.'
    };
  }

  const firstValue = numericDaily[0].moodValue;
  const lastValue = numericDaily[numericDaily.length - 1].moodValue;
  const minEntry = numericDaily.reduce((lowest, entry) => (entry.moodValue < lowest.moodValue ? entry : lowest), numericDaily[0]);
  const maxEntry = numericDaily.reduce((highest, entry) => (entry.moodValue > highest.moodValue ? entry : highest), numericDaily[0]);
  const delta = roundToOneDecimal(lastValue - firstValue);

  let trend = 'stable';
  if (delta >= 0.4) trend = 'hausse';
  else if (delta <= -0.4) trend = 'baisse';

  const summaryParts = [];
  if (Math.abs(delta) >= 0.4) {
    summaryParts.push(`Écart entre début et fin de semaine: ${delta > 0 ? '+' : ''}${String(delta).replace('.', ',')} point.`);
  } else {
    summaryParts.push('Évolution globale limitée entre le début et la fin de semaine.');
  }

  if (minEntry.date !== maxEntry.date) {
    summaryParts.push(`Point bas le ${minEntry.date} à ${String(minEntry.moodValue).replace('.', ',')}/10, point haut le ${maxEntry.date} à ${String(maxEntry.moodValue).replace('.', ',')}/10.`);
  }

  return {
    trend,
    strength: getTrendStrength(numericDaily),
    lowestDay: {
      date: minEntry.date,
      moodValue: minEntry.moodValue
    },
    highestDay: {
      date: maxEntry.date,
      moodValue: maxEntry.moodValue
    },
    summary: summaryParts.join(' ')
  };
};

const serializeUserInsightPayload = (payload) => ({
  weekStart: payload.weekStart,
  weekEnd: payload.weekEnd,
  generated: payload.generated,
  summaryText: payload.summaryText,
  metrics: payload.metrics
});

const updateUserInfo = async ({ userId, firstName, lastName }) => {
  if (!firstName || !lastName) {
    throw new AppError('First name and last name are required', 400, 'VALIDATION_ERROR');
  }

  await userRepository.updateNames({ userId, firstName, lastName });
  const user = await userRepository.getById(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  return {
    message: 'User info updated successfully',
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    }
  };
};

const completeOnboarding = async ({ userId, workStyle, motivationType, stressSource }) => {
  const normalizeMap = {
    Structure: 'Structuré',
    Equilibre: 'Équilibre',
    Delais: 'Délais'
  };

  const normalizedWorkStyle = normalizeMap[workStyle] || workStyle;
  const normalizedMotivationType = normalizeMap[motivationType] || motivationType;
  const normalizedStressSource = normalizeMap[stressSource] || stressSource;

  const validWorkStyles = ['Collaboratif', 'Autonome', 'Structuré', 'Flexible'];
  const validMotivationTypes = ['Reconnaissance', 'Apprentissage', 'Impact', 'Équilibre'];
  const validStressSources = ['Charge de travail', 'Relations', 'Incertitude', 'Délais'];

  if (!validWorkStyles.includes(normalizedWorkStyle)) {
    throw new AppError(
      `Invalid work_style. Must be one of: ${validWorkStyles.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }
  if (!validMotivationTypes.includes(normalizedMotivationType)) {
    throw new AppError(
      `Invalid motivation_type. Must be one of: ${validMotivationTypes.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }
  if (!validStressSources.includes(normalizedStressSource)) {
    throw new AppError(
      `Invalid stress_source. Must be one of: ${validStressSources.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  await userRepository.updateOnboarding({
    userId,
    workStyle: normalizedWorkStyle,
    motivationType: normalizedMotivationType,
    stressSource: normalizedStressSource
  });

  return {
    message: 'Onboarding completed successfully'
  };
};

const getUserInfo = async ({ userId }) => {
  const user = await userRepository.getById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  return user;
};

const getWeeklyInsight = async ({ userId, weekStart }) => {
  assertValidWeekStart(weekStart);
  const { start, end } = getPeriodRange({ period: 'week', weekStart });
  const rangeStartStr = toDateOnly(start);
  const rangeEndStr = toDateOnly(end);

  const existingInsight = await userWeeklyInsightRepository.getByScope({
    userId,
    weekStart: rangeStartStr
  });

  if (existingInsight) {
    return existingInsight.payload;
  }

  const [dailyRows, rawRows, feedbackCategoryRows] = await Promise.all([
    checkinRepository.getByDateRange(userId, rangeStartStr, rangeEndStr),
    checkinRepository.getByDateRangeWithCauses(userId, rangeStartStr, rangeEndStr),
    feedbackRepository.getWeeklyCategoryCountsByUser(userId, rangeStartStr, rangeEndStr)
  ]);

  if (rawRows.length === 0) {
    return {
      weekStart: rangeStartStr,
      weekEnd: rangeEndStr,
      generated: false,
      summaryText: null,
      metrics: { ...EMPTY_INSIGHT_METRICS }
    };
  }

  const feedbackCategories = {};
  feedbackCategoryRows.forEach((row) => {
    feedbackCategories[row.category] = row.count;
  });

  const causeCounts = {};
  let moodTotal = 0;
  let moodCount = 0;
  rawRows.forEach((row) => {
    if (row.moodValue !== null && row.moodValue !== undefined) {
      moodTotal += row.moodValue;
      moodCount += 1;
    }

    const causes = parseCauses(row.causes).filter((cause) => VALID_CAUSES.includes(cause));
    causes.forEach((cause) => {
      causeCounts[cause] = (causeCounts[cause] || 0) + 1;
    });
  });

  const topCauses = Object.entries(causeCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([cause]) => cause);

  const moodByDate = {};
  dailyRows.forEach((row) => {
    if (row.moodValue !== null && row.moodValue !== undefined) {
      moodByDate[row.date] = row.moodValue;
    }
  });

  const stats = createWeeklyStats();
  const dailyResult = buildDailyForWeek({ start, moodByDate, stats });
  const publicDaily = dailyResult.daily.map((entry) => ({
    date: entry.date,
    moodValue: entry.moodValue === null || entry.moodValue === undefined ? null : Number((entry.moodValue / 10).toFixed(1)),
    label: entry.label
  }));
  const metrics = {
    averageMood: moodCount ? Number((moodTotal / moodCount / 10).toFixed(1)) : null,
    participation: dailyResult.participation,
    participationRate: Math.round((dailyResult.participation * 100) / 5),
    topCauses,
    feedbackCategories,
    daily: publicDaily
  };
  const trendSummary = getDailyTrendSummary(publicDaily);
  const feedbackLabels = Object.entries(feedbackCategories).reduce((acc, [category, count]) => {
    acc[FEEDBACK_CATEGORY_LABELS[category] || category.toLowerCase()] = count;
    return acc;
  }, {});
  const insightContext = {
    moodBand: getMoodBand(metrics.averageMood),
    topCauseLabels: topCauses.map((cause) => CAUSE_LABELS[cause] || cause.toLowerCase()),
    feedbackCategoryLabels: feedbackLabels,
    trend: trendSummary.trend,
    trendStrength: trendSummary.strength,
    lowestDay: trendSummary.lowestDay,
    highestDay: trendSummary.highestDay,
    trendSummary: trendSummary.summary
  };
  const payload = {
    weekStart: rangeStartStr,
    weekEnd: rangeEndStr,
    generated: true,
    summaryText: null,
    metrics
  };

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const lockedInsight = await userWeeklyInsightRepository.getByScopeForUpdate({
      userId,
      weekStart: rangeStartStr,
      client
    });

    if (lockedInsight) {
      await client.query('COMMIT');
      return lockedInsight.payload;
    }

    payload.summaryText = await groqClient.generateUserWeeklyInsight({
      weekStart: rangeStartStr,
      weekEnd: rangeEndStr,
      metrics,
      insightContext
    });

    await userWeeklyInsightRepository.createInsight({
      id: uuidv4(),
      userId,
      weekStart: rangeStartStr,
      weekEnd: rangeEndStr,
      payload: serializeUserInsightPayload(payload),
      generatedAt: new Date().toISOString(),
      createdByUserId: userId,
      updatedByUserId: userId,
      client
    });

    await client.query('COMMIT');
    return payload;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Erreur lors du rollback user weekly insight:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  updateUserInfo,
  completeOnboarding,
  getUserInfo,
  getWeeklyInsight
};
