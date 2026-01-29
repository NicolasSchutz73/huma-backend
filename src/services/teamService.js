const { v4: uuidv4 } = require('uuid');
const teamRepository = require('../repositories/teamRepository');
const userRepository = require('../repositories/userRepository');
const { AppError } = require('../utils/errors');

const getMoodLabel = (score) => {
  if (score >= 8) return "L'équipe est au top !";
  if (score >= 6) return "Tout va bien aujourd'hui";
  if (score >= 4) return "Ambiance mitigée";
  return "Journée difficile pour l'équipe";
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

  if (queryTeamId) {
    const isMember = await teamRepository.isMember(queryTeamId, userId);
    if (!isMember) {
      throw new AppError("Vous n'appartenez pas à cette équipe", 403, 'FORBIDDEN');
    }
    return fetchTeamStats(queryTeamId);
  }

  const teamId = await teamRepository.getFirstTeamIdByUser(userId);
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
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
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
  createTeam,
  addMember
};
