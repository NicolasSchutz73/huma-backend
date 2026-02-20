const { AppError } = require('../utils/errors');

const VALID_CAUSES = ['WORKLOAD', 'RELATIONS', 'MOTIVATION', 'CLARITY', 'RECOGNITION', 'BALANCE'];
const DAY_LABELS = {
  excellent: 'Jour excellent',
  correct: 'Jour correct',
  difficult: 'Jour difficile',
  missing: 'Aucun check-in'
};
const MOOD_BUCKETS = [
  { label: 'Éprouvé', min: 0, max: 20 },
  { label: 'Sous tension', min: 21, max: 40 },
  { label: 'Mitigé', min: 41, max: 60 },
  { label: 'Serein', min: 61, max: 80 },
  { label: 'Épanoui', min: 81, max: 100 }
];

const parseDateOnly = (value) => {
  if (!value || typeof value !== 'string') return null;
  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateOnlyMatch.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const parseMonthOnly = (value) => {
  if (!value || typeof value !== 'string') return null;
  const monthOnlyMatch = /^\d{4}-\d{2}$/;
  if (!monthOnlyMatch.test(value)) return null;
  const date = new Date(`${value}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const parseYearOnly = (value) => {
  if (!value || typeof value !== 'string') return null;
  const yearOnlyMatch = /^\d{4}$/;
  if (!yearOnlyMatch.test(value)) return null;
  const date = new Date(`${value}-01-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toDateOnly = (date) => date.toISOString().split('T')[0];

const getWeekMonday = (date) => {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday;
};

const getMonthRange = (date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { start, end };
};

const getYearRange = (date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
  return { start, end };
};

const getPeriodRange = ({ period, weekStart, date }) => {
  if (period === 'month') {
    const baseDate = parseMonthOnly(date) || new Date();
    return getMonthRange(baseDate);
  }

  if (period === 'year') {
    const baseDate = parseYearOnly(date) || new Date();
    return getYearRange(baseDate);
  }

  const baseDate = parseDateOnly(weekStart) || parseDateOnly(date) || new Date();
  const monday = getWeekMonday(baseDate);
  const friday = new Date(monday);
  friday.setUTCDate(friday.getUTCDate() + 4);
  return { start: monday, end: friday };
};

const validatePeriodDate = ({ period, date }) => {
  if (!date) return;
  if (period === 'month' && !parseMonthOnly(date)) {
    throw new AppError('date must be in YYYY-MM format for period=month', 400, 'VALIDATION_ERROR');
  }
  if (period === 'year' && !parseYearOnly(date)) {
    throw new AppError('date must be in YYYY format for period=year', 400, 'VALIDATION_ERROR');
  }
  if (period === 'week' && !parseDateOnly(date)) {
    throw new AppError('date must be in YYYY-MM-DD format for period=week', 400, 'VALIDATION_ERROR');
  }
};

const getMoodLabel = (moodValue) => {
  if (moodValue === null || moodValue === undefined) return DAY_LABELS.missing;
  if (moodValue >= 70) return DAY_LABELS.excellent;
  if (moodValue >= 40) return DAY_LABELS.correct;
  return DAY_LABELS.difficult;
};

const createWeeklyStats = () => ({
  excellentDays: 0,
  correctDays: 0,
  difficultDays: 0,
  missingDays: 0
});

const applyDailyStats = ({ moodValue, label, stats }) => {
  if (label === DAY_LABELS.excellent) stats.excellentDays += 1;
  else if (label === DAY_LABELS.correct) stats.correctDays += 1;
  else if (label === DAY_LABELS.difficult) stats.difficultDays += 1;
  else stats.missingDays += 1;
  return moodValue !== null && moodValue !== undefined ? 1 : 0;
};

const buildDailyEntry = ({ dateStr, moodValue, stats }) => {
  const label = getMoodLabel(moodValue);
  const participationDelta = applyDailyStats({ moodValue, label, stats });
  return {
    entry: { date: dateStr, moodValue, label },
    participationDelta
  };
};

const buildDailyForWeek = ({ start, moodByDate, stats }) => {
  const daily = [];
  let participation = 0;

  for (let i = 0; i < 5; i++) {
    const dateCursor = new Date(start);
    dateCursor.setUTCDate(dateCursor.getUTCDate() + i);
    const dateStr = toDateOnly(dateCursor);
    const moodValue = moodByDate[dateStr] ?? null;
    const { entry, participationDelta } = buildDailyEntry({ dateStr, moodValue, stats });
    participation += participationDelta;
    daily.push(entry);
  }

  return { daily, participation };
};

const buildDailyForMonth = ({ start, end, moodByDate, stats }) => {
  const daily = [];
  let participation = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const dateStr = toDateOnly(cursor);
    const moodValue = moodByDate[dateStr] ?? null;
    const { entry, participationDelta } = buildDailyEntry({ dateStr, moodValue, stats });
    participation += participationDelta;
    daily.push(entry);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { daily, participation };
};

const buildDailyForYear = ({ start, end, moodByDate, stats }) => {
  const monthBuckets = {};
  let participation = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const dateStr = toDateOnly(cursor);
    const moodValue = moodByDate[dateStr] ?? null;
    const label = getMoodLabel(moodValue);
    const monthKey = dateStr.slice(0, 7);

    if (!monthBuckets[monthKey]) {
      monthBuckets[monthKey] = { total: 0, count: 0, participation: 0 };
    }

    if (moodValue !== null && moodValue !== undefined) {
      participation += 1;
      monthBuckets[monthKey].total += moodValue;
      monthBuckets[monthKey].count += 1;
      monthBuckets[monthKey].participation += 1;
    }

    applyDailyStats({ moodValue, label, stats });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const daily = Object.keys(monthBuckets)
    .sort((a, b) => a.localeCompare(b))
    .map((month) => {
      const bucket = monthBuckets[month];
      return {
        month,
        averageMood: bucket.count ? Number((bucket.total / bucket.count / 10).toFixed(1)) : null,
        participation: bucket.participation
      };
    });

  return { daily, participation };
};

const parseCauses = (causesValue) => {
  if (!causesValue) return [];
  if (Array.isArray(causesValue)) return causesValue;
  try {
    const parsed = JSON.parse(causesValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const buildBucketSummary = (moodValues) => {
  const buckets = MOOD_BUCKETS.map((bucket) => ({
    label: bucket.label,
    range: [bucket.min, bucket.max],
    count: 0,
    percent: 0
  }));

  moodValues.forEach((value) => {
    const bucket = buckets.find(({ range }) => value >= range[0] && value <= range[1]);
    if (bucket) bucket.count += 1;
  });

  const total = moodValues.length;
  buckets.forEach((bucket) => {
    bucket.percent = total ? Math.round((bucket.count * 100) / total) : 0;
  });

  return {
    totalCheckins: total,
    buckets
  };
};

module.exports = {
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
};
