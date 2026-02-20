const { v4: uuidv4 } = require('uuid');
const teamRepository = require('../repositories/teamRepository');
const userRepository = require('../repositories/userRepository');
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

const getMoodLabel = (score) => {
  if (score >= 8) return "L'équipe est au top !";
  if (score >= 6) return "Tout va bien aujourd'hui";
  if (score >= 4) return "Ambiance mitigée";
  return "Journée difficile pour l'équipe";
};

const resolveTeamIdForUser = async ({ userId, queryTeamId }) => {
  if (queryTeamId) {
    const isMember = await teamRepository.isMember(queryTeamId, userId);
    if (!isMember) {
      throw new AppError("Vous n'appartenez pas à cette équipe", 403, 'FORBIDDEN');
    }
    return queryTeamId;
  }

  return teamRepository.getFirstTeamIdByUser(userId);
};

const buildPeriodDaily = ({ period, start, end, moodByDate, stats }) => {
  if (period === 'month') {
    return buildDailyForMonth({ start, end, moodByDate, stats });
  }
  if (period === 'year') {
    return buildDailyForYear({ start, end, moodByDate, stats });
  }
  return buildDailyForWeek({ start, moodByDate, stats });
};

const getTeamStats = async ({ userId, queryTeamId }) => {
  const today = new Date().toISOString().split('T')[0];

  const fetchTeamStats = async (teamId) => {
    const members = await teamRepository.getMemberIdsByTeam(teamId);

    if (members.length === 0) {
      return {
        globalScore: 0,
        moodLabel: 'Aucune donnée disponible',
        distribution: {},
        weeklyTrend: []
      };
    }

    const memberIds = members.map(m => m.user_id);

    const todayData = await teamRepository.getTodayStats({ memberIds, today });
    const globalScore = todayData && todayData.avgMood ? Math.round((todayData.avgMood / 10) * 10) / 10 : 0;
    const totalCheckins = todayData && todayData.count ? todayData.count : 0;

    const causesData = await teamRepository.getTodayCauses({ memberIds, today });
    const causeCounts = {};
    causesData.forEach(row => {
      try {
        const causes = JSON.parse(row.causes);
        if (Array.isArray(causes)) {
          causes.forEach(cause => {
            causeCounts[cause] = (causeCounts[cause] || 0) + 1;
          });
        }
      } catch (e) {
        // Ignorer les causes mal formatées
      }
    });

    const sortedCauses = Object.entries(causeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const distribution = {};
    sortedCauses.forEach(([cause, count]) => {
      distribution[cause] = totalCheckins > 0 ? Math.round((count / totalCheckins) * 100) : 0;
    });

    const weekData = await teamRepository.getWeeklyTrend({ memberIds });
    const dayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    const weeklyTrend = weekData.map(row => {
      const date = new Date(row.day);
      const dayIndex = date.getUTCDay();
      return {
        day: dayLabels[dayIndex],
        value: Math.round((row.avgMood / 10) * 10) / 10
      };
    });

    return {
      globalScore,
      moodLabel: getMoodLabel(globalScore),
      distribution,
      weeklyTrend
    };
  };

  const teamId = await resolveTeamIdForUser({ userId, queryTeamId });
  if (!teamId) {
    return {
      globalScore: 0,
      moodLabel: "Vous n'appartenez à aucune équipe",
      distribution: {},
      weeklyTrend: []
    };
  }

  return fetchTeamStats(teamId);
};

const getWeeklySummary = async ({ userId, queryTeamId, weekStart, period = 'week', date }) => {
  validatePeriodDate({ period, date });
  const { start, end } = getPeriodRange({ period, weekStart, date });
  const rangeStartStr = toDateOnly(start);
  const rangeEndStr = toDateOnly(end);
  const teamId = await resolveTeamIdForUser({ userId, queryTeamId });

  let dailyRows = [];
  let rawRows = [];
  if (teamId) {
    [dailyRows, rawRows] = await Promise.all([
      teamRepository.getByDateRange(teamId, rangeStartStr, rangeEndStr),
      teamRepository.getByDateRangeWithCauses(teamId, rangeStartStr, rangeEndStr)
    ]);
  }

  const moodByDate = {};
  dailyRows.forEach((row) => {
    if (row.moodValue !== null && row.moodValue !== undefined) {
      moodByDate[row.date] = Number(row.moodValue.toFixed(1));
    }
  });

  let moodTotal = 0;
  let moodCount = 0;
  rawRows.forEach((row) => {
    if (row.moodValue !== null && row.moodValue !== undefined) {
      moodTotal += row.moodValue;
      moodCount += 1;
    }
  });

  const stats = createWeeklyStats();
  const dailyResult = buildPeriodDaily({ period, start, end, moodByDate, stats });

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

const getWeeklyFactors = async ({ userId, queryTeamId, weekStart, period = 'week', date }) => {
  validatePeriodDate({ period, date });
  const { start, end } = getPeriodRange({ period, weekStart, date });
  const rangeStartStr = toDateOnly(start);
  const rangeEndStr = toDateOnly(end);
  const teamId = await resolveTeamIdForUser({ userId, queryTeamId });

  let rows = [];
  if (teamId) {
    rows = await teamRepository.getByDateRangeWithCauses(teamId, rangeStartStr, rangeEndStr);
  }

  const availableCauses = new Set();
  const summaryValues = [];
  const byCauseValues = {};

  rows.forEach((row) => {
    if (row.moodValue !== null && row.moodValue !== undefined) {
      summaryValues.push(row.moodValue);
    }

    const causes = parseCauses(row.causes).filter((cause) => VALID_CAUSES.includes(cause));
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

const createTeam = async ({ name, organizationId, userOrganizationId }) => {
  if (!name) {
    throw new AppError('name is required', 400, 'VALIDATION_ERROR');
  }

  const orgId = organizationId || userOrganizationId;
  const teamId = uuidv4();

  await teamRepository.createTeam({ id: teamId, organizationId: orgId, name });

  return {
    message: 'Équipe créée avec succès',
    team: {
      id: teamId,
      name,
      organizationId: orgId
    }
  };
};

const addMember = async ({ teamId, userId }) => {
  if (!teamId) {
    throw new AppError('teamId is required', 400, 'VALIDATION_ERROR');
  }

  if (!userId) {
    throw new AppError('userId is required', 400, 'VALIDATION_ERROR');
  }

  const teamExists = await teamRepository.getTeamById(teamId);
  if (!teamExists) {
    throw new AppError('Équipe non trouvée', 404, 'NOT_FOUND');
  }

  const userExists = await userRepository.getIdById(userId);
  if (!userExists) {
    throw new AppError('Utilisateur non trouvé', 404, 'NOT_FOUND');
  }

  const memberId = uuidv4();

  try {
    await teamRepository.addMember({ id: memberId, teamId, userId });
  } catch (err) {
    if (err.code === '23505' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
      throw new AppError('Utilisateur déjà membre de cette équipe', 409, 'CONFLICT');
    }
    throw err;
  }

  return {
    message: 'Membre ajouté avec succès',
    member: {
      id: memberId,
      teamId,
      userId
    }
  };
};

module.exports = {
  getTeamStats,
  getWeeklySummary,
  getWeeklyFactors,
  createTeam,
  addMember
};
