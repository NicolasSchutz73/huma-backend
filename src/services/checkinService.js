const { v4: uuidv4 } = require('uuid');
const checkinRepository = require('../repositories/checkinRepository');
const { AppError } = require('../utils/errors');
const {
  VALID_CAUSES,
  createWeeklyStats,
  getPeriodRange,
  validatePeriodDate,
  toDateOnly,
  buildDailyForWeek,
  buildDailyForMonth,
  buildDailyForYear,
  parseCauses,
  buildBucketSummary
} = require('./checkinPeriodUtils');

const getTodayCheckin = async ({ userId }) => {
  const today = new Date().toISOString().split('T')[0];
  const row = await checkinRepository.getByUserAndDate(userId, today);
  return { hasCheckedIn: !!row };
};

const createCheckin = async ({ userId, moodValue, causes, comment, timestamp }) => {
  if (moodValue === undefined || moodValue === null) {
    throw new AppError('moodValue is required', 400, 'VALIDATION_ERROR');
  }

  if (moodValue < 1 || moodValue > 100) {
    throw new AppError('moodValue must be between 1 and 100', 400, 'VALIDATION_ERROR');
  }

  if (!timestamp) {
    throw new AppError('timestamp is required', 400, 'VALIDATION_ERROR');
  }

  if (causes && Array.isArray(causes)) {
    const invalidCauses = causes.filter(cause => !VALID_CAUSES.includes(cause));
    if (invalidCauses.length > 0) {
      throw new AppError(
        `Invalid causes: ${invalidCauses.join(', ')}. Valid causes are: ${VALID_CAUSES.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  const checkinDate = new Date(timestamp).toISOString().split('T')[0];
  const existingCheckin = await checkinRepository.getByUserAndDate(userId, checkinDate);

  if (existingCheckin) {
    throw new AppError('Un check-in existe déjà pour cette date', 409, 'CONFLICT');
  }

  const id = uuidv4();
  const causesJson = causes ? JSON.stringify(causes) : null;

  await checkinRepository.createCheckin({
    id,
    userId,
    moodValue,
    causesJson,
    comment,
    timestamp
  });

  return {
    message: 'Check-in créé avec succès',
    checkin: {
      id,
      moodValue,
      causes: causes || [],
      comment: comment || null,
      timestamp
    }
  };
};

const getHistory = async ({ userId, days = 30 }) => {
  const rows = await checkinRepository.getHistoryByDays(userId, days);

  const checkinsByDate = {};
  rows.forEach(row => {
    checkinsByDate[row.date] = row.moodValue;
  });

  const history = [];
  const today = new Date();

  for (let i = 0; i < parseInt(days); i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    if (checkinsByDate[dateStr] !== undefined) {
      history.push({
        date: dateStr,
        status: 'completed',
        moodValue: checkinsByDate[dateStr]
      });
    } else {
      history.push({
        date: dateStr,
        status: 'missed',
        moodValue: null
      });
    }
  }

  return history;
};

const getWeeklySummary = async ({ userId, weekStart, period = 'week', date }) => {
  validatePeriodDate({ period, date });
  const { start, end } = getPeriodRange({ period, weekStart, date });
  const rangeStartStr = toDateOnly(start);
  const rangeEndStr = toDateOnly(end);

  const rows = await checkinRepository.getByDateRange(userId, rangeStartStr, rangeEndStr);

  const moodByDate = {};
  let moodTotal = 0;
  let moodCount = 0;
  rows.forEach(row => {
    moodByDate[row.date] = row.moodValue;
    if (row.moodValue !== null && row.moodValue !== undefined) {
      moodTotal += row.moodValue;
      moodCount += 1;
    }
  });

  const stats = createWeeklyStats();
  let dailyResult;

  if (period === 'month') {
    dailyResult = buildDailyForMonth({ start, end, moodByDate, stats });
  } else if (period === 'year') {
    dailyResult = buildDailyForYear({ start, end, moodByDate, stats });
  } else {
    dailyResult = buildDailyForWeek({ start, moodByDate, stats });
  }

  return {
    weekStart: rangeStartStr,
    weekEnd: rangeEndStr,
    period,
    participation: dailyResult.participation,
    averageMood: moodCount ? Number((moodTotal / moodCount / 10).toFixed(1)) : null,
    daily: dailyResult.daily,
    stats
  };
};

const getWeeklyFactors = async ({ userId, weekStart, period = 'week', date }) => {
  validatePeriodDate({ period, date });
  const { start, end } = getPeriodRange({ period, weekStart, date });
  const rangeStartStr = toDateOnly(start);
  const rangeEndStr = toDateOnly(end);

  const rows = await checkinRepository.getByDateRangeWithCauses(userId, rangeStartStr, rangeEndStr);
  const availableCauses = new Set();
  const summaryValues = [];
  const byCauseValues = {};

  rows.forEach((row) => {
    if (row.moodValue !== null && row.moodValue !== undefined) {
      summaryValues.push(row.moodValue);
    }

    const causes = parseCauses(row.causes).filter(cause => VALID_CAUSES.includes(cause));
    causes.forEach((cause) => {
      availableCauses.add(cause);
      if (!byCauseValues[cause]) byCauseValues[cause] = [];
      if (row.moodValue !== null && row.moodValue !== undefined) {
        byCauseValues[cause].push(row.moodValue);
      }
    });
  });

  const byCause = {};
  Object.keys(byCauseValues).forEach((cause) => {
    byCause[cause] = buildBucketSummary(byCauseValues[cause]);
  });

  return {
    weekStart: rangeStartStr,
    weekEnd: rangeEndStr,
    period,
    availableCauses: Array.from(availableCauses),
    summary: buildBucketSummary(summaryValues),
    byCause
  };
};

module.exports = {
  getTodayCheckin,
  createCheckin,
  getHistory,
  getWeeklySummary,
  getWeeklyFactors
};
