const { v4: uuidv4 } = require('uuid');
const checkinRepository = require('../repositories/checkinRepository');
const { AppError } = require('../utils/errors');

const VALID_CAUSES = ['WORKLOAD', 'RELATIONS', 'MOTIVATION', 'CLARITY', 'RECOGNITION', 'BALANCE'];
const DAY_LABELS = {
  excellent: 'Jour excellent',
  correct: 'Jour correct',
  difficult: 'Jour difficile',
  missing: 'Aucun check-in'
};

const parseDateOnly = (value) => {
  if (!value || typeof value !== 'string') return null;
  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateOnlyMatch.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
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

const getMoodLabel = (moodValue) => {
  if (moodValue === null || moodValue === undefined) return DAY_LABELS.missing;
  if (moodValue >= 70) return DAY_LABELS.excellent;
  if (moodValue >= 40) return DAY_LABELS.correct;
  return DAY_LABELS.difficult;
};

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

const getWeeklySummary = async ({ userId, weekStart }) => {
  const baseDate = parseDateOnly(weekStart) || new Date();
  const monday = getWeekMonday(baseDate);
  const friday = new Date(monday);
  friday.setUTCDate(friday.getUTCDate() + 4);

  const weekStartStr = toDateOnly(monday);
  const weekEndStr = toDateOnly(friday);

  const rows = await checkinRepository.getByDateRange(userId, weekStartStr, weekEndStr);

  const moodByDate = {};
  rows.forEach(row => {
    moodByDate[row.date] = row.moodValue;
  });

  const daily = [];
  const stats = {
    excellentDays: 0,
    correctDays: 0,
    difficultDays: 0,
    missingDays: 0
  };

  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + i);
    const dateStr = toDateOnly(date);
    const moodValue = moodByDate[dateStr] ?? null;
    const label = getMoodLabel(moodValue);

    if (label === DAY_LABELS.excellent) stats.excellentDays += 1;
    else if (label === DAY_LABELS.correct) stats.correctDays += 1;
    else if (label === DAY_LABELS.difficult) stats.difficultDays += 1;
    else stats.missingDays += 1;

    daily.push({ date: dateStr, moodValue, label });
  }

  return {
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    daily,
    stats
  };
};

module.exports = {
  getTodayCheckin,
  createCheckin,
  getHistory,
  getWeeklySummary
};
