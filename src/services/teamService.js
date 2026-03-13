const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const teamRepository = require('../repositories/teamRepository');
const dbPool = require('../db/index');
const userRepository = require('../repositories/userRepository');
const feedbackRepository = require('../repositories/feedbackRepository');
const teamWeeklyReportRepository = require('../repositories/teamWeeklyReportRepository');
const { AppError } = require('../utils/errors');
const groqClient = require('./groqClient');
const { actionCatalog, activityCatalog } = require('./teamAnalysisCatalog');
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

const EMPTY_INSIGHT_METRICS = {
  averageMood: null,
  participation: 0,
  participationRate: 0,
  previousParticipationRate: null,
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

const WEEKLY_REPORT_GENERATION_LIMIT = 2;
const REPORT_TYPE_WEEKLY_TEAM_INSIGHT = teamWeeklyReportRepository.REPORT_TYPE_WEEKLY_TEAM_INSIGHT;

const positiveCauseMap = {
  RELATIONS: 'Bonne ambiance et relations d’équipe',
  RECOGNITION: 'Reconnaissance perçue dans les échanges',
  MOTIVATION: 'Motivation globalement présente',
  CLARITY: 'Repères et priorités plutôt lisibles',
  BALANCE: 'Équilibre vie pro / vie perso relativement préservé',
  WORKLOAD: "Capacité de l'équipe à encaisser la charge"
};

const weaknessCauseMap = {
  WORKLOAD: 'Charge de travail excessive ou mal priorisée',
  BALANCE: 'Déséquilibre vie pro / vie perso',
  RECOGNITION: 'Manque de reconnaissance',
  CLARITY: 'Manque de clarté et de sens',
  MOTIVATION: 'Fatigue motivationnelle',
  RELATIONS: 'Friction relationnelle dans l’équipe'
};

const weaknessCauseDescriptions = {
  WORKLOAD: 'La charge semble peser sur le rythme collectif et alimente un risque de dispersion.',
  BALANCE: "L'équilibre vie pro / vie perso apparaît sous tension sur plusieurs signaux faibles.",
  RECOGNITION: 'La reconnaissance perçue reste insuffisante pour soutenir durablement la motivation.',
  CLARITY: 'La clarté des priorités reste perfectible, ce qui peut entretenir le flou et les reworks.',
  MOTIVATION: "La motivation paraît plus fragile cette semaine, avec un risque d'usure si rien n'est ajusté.",
  RELATIONS: "Les interactions d'équipe ne semblent pas être un appui assez solide cette semaine."
};

const AnalysisReportSchema = z.object({
  strengths: z.array(z.object({
    rank: z.number().int().min(1),
    title: z.string().min(1),
    weight: z.number().int().min(0).max(100),
    description: z.string().min(1)
  })).length(3),
  weaknesses: z.array(z.object({
    rank: z.number().int().min(1),
    title: z.string().min(1),
    weight: z.number().int().min(0).max(100),
    description: z.string().min(1)
  })).length(5),
  recommendedActions: z.array(z.object({
    id: z.string().min(1),
    summary: z.string().min(1)
  })).length(4),
  teamActivities: z.array(z.object({
    id: z.string().min(1),
    summary: z.string().min(1)
  })).length(3)
});

const getMoodLabel = (score) => {
  if (score >= 8) return "L'équipe est au top !";
  if (score >= 6) return "Tout va bien aujourd'hui";
  if (score >= 4) return "Ambiance mitigée";
  return "Journée difficile pour l'équipe";
};

const clampWeight = (value) => Math.max(0, Math.min(100, Math.round(value)));

const getCatalogById = (catalog) =>
  catalog.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

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

const resolveTeamIdForAnalysisReport = async ({ userId, userRole, queryTeamId }) => {
  if (!['manager', 'admin'].includes(userRole)) {
    throw new AppError('Forbidden: manager or admin role required', 403, 'FORBIDDEN');
  }

  if (userRole === 'admin') {
    if (!queryTeamId) {
      throw new AppError('teamId is required for admin analysis report', 400, 'VALIDATION_ERROR');
    }

    const teamExists = await teamRepository.getTeamById(queryTeamId);
    if (!teamExists) {
      throw new AppError('Équipe non trouvée', 404, 'NOT_FOUND');
    }
    return queryTeamId;
  }

  return resolveTeamIdForUser({ userId, queryTeamId });
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

const roundToOneDecimal = (value) => Number((value).toFixed(1));

const getMoodBand = (averageMood) => {
  if (averageMood === null || averageMood === undefined) return 'sans donnée exploitable';
  if (averageMood >= 7.5) return 'positive';
  if (averageMood >= 6) return 'correcte';
  if (averageMood >= 4.5) return 'fragile';
  return 'très dégradée';
};

const getAnalysisMode = ({ averageMood, participationRate, trend }) => {
  if (averageMood === null || averageMood === undefined) return 'mixed';
  if (averageMood >= 7.5 && participationRate >= 85 && trend !== 'baisse') return 'healthy';
  if (averageMood < 5 || (averageMood < 6 && trend === 'baisse')) return 'critical';
  return 'mixed';
};

const getTrendStrength = (daily) => {
  const numericDaily = daily.filter((entry) => entry.moodValue !== null && entry.moodValue !== undefined);
  if (numericDaily.length < 2) return 'stable';

  const values = numericDaily.map((entry) => entry.moodValue);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const amplitude = roundToOneDecimal(maxValue - minValue);

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
  const strength = getTrendStrength(numericDaily);

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
    strength,
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

const getDeltaValue = (currentValue, previousValue) => {
  if (currentValue === null || currentValue === undefined) return null;
  if (previousValue === null || previousValue === undefined) return null;
  return roundToOneDecimal(currentValue - previousValue);
};

const getWeekParticipationRate = ({ participation, period }) => {
  if (period !== 'week') return null;
  return Math.round((participation * 100) / 5);
};

const getQvtBarometerValue = ({ averageMood, participationRate, trend }) => {
  if (averageMood === null || averageMood === undefined) return null;

  let score = averageMood * 0.75;
  if (participationRate !== null && participationRate !== undefined) {
    score += (participationRate / 100) * 2;
  }

  if (trend === 'hausse') score += 0.5;
  else if (trend === 'baisse') score -= 0.5;

  return roundToOneDecimal(Math.max(0, Math.min(10, score)));
};

const buildWeeklyDashboard = ({ current, previous }) => ({
  averageMood: {
    value: current.averageMood,
    deltaVsPreviousWeek: previous.hasData ? getDeltaValue(current.averageMood, previous.averageMood) : null
  },
  participation: {
    value: current.participationRate,
    deltaVsPreviousWeek: previous.hasData ? getDeltaValue(current.participationRate, previous.participationRate) : null
  },
  qvtBarometer: {
    value: current.qvtBarometerValue,
    deltaVsPreviousWeek: previous.hasData ? getDeltaValue(current.qvtBarometerValue, previous.qvtBarometerValue) : null,
    label: 'Indice annuel évolutif'
  }
});

const buildWeeklySummarySnapshot = ({ start, end, period, dailyRows, rawRows }) => {
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
  const averageMood = moodCount ? Number((moodTotal / moodCount / 10).toFixed(1)) : null;
  const publicDaily = dailyResult.daily.map((entry) => ({
    date: entry.date,
    moodValue: entry.moodValue === null || entry.moodValue === undefined ? null : Number((entry.moodValue / 10).toFixed(1)),
    label: entry.label
  }));
  const trendSummary = getDailyTrendSummary(publicDaily);
  const participationRate = getWeekParticipationRate({ participation: dailyResult.participation, period });
  const qvtBarometerValue = getQvtBarometerValue({
    averageMood,
    participationRate,
    trend: trendSummary.trend
  });

  return {
    participation: dailyResult.participation,
    averageMood,
    daily: dailyResult.daily,
    stats,
    hasData: rawRows.length > 0,
    dashboardMetrics: {
      averageMood,
      participationRate,
      qvtBarometerValue,
      hasData: rawRows.length > 0
    }
  };
};

const getCauseWeights = (causeCounts) => {
  const total = Object.values(causeCounts).reduce((sum, value) => sum + value, 0);
  if (!total) return [];

  return Object.entries(causeCounts)
    .map(([cause, count]) => ({
      cause,
      label: CAUSE_LABELS[cause] || cause.toLowerCase(),
      count,
      weight: clampWeight((count * 100) / total)
    }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count || a.label.localeCompare(b.label));
};

const getMoodBuckets = (values) => {
  const summary = buildBucketSummary(values);
  return summary.buckets.map((bucket) => ({
    label: bucket.label,
    range: bucket.range,
    count: bucket.count,
    percent: bucket.percent
  }));
};

const getStrengthCandidates = ({
  participationRate,
  moodBand,
  trend,
  trendStrength,
  topCauseWeights,
  feedbackLabels,
  excludedCauses,
  analysisMode
}) => {
  const items = [];
  const excluded = new Set(excludedCauses || []);
  const hasFeedbacks = Object.keys(feedbackLabels).length > 0;

  if (analysisMode === 'critical') {
    if (participationRate >= 85) {
      items.push({
        title: "L'équipe continue à répondre malgré la difficulté",
        weight: 28,
        description: "La participation reste forte, ce qui montre une présence collective encore mobilisable malgré un climat dégradé."
      });
    }

    if (trend === 'stable' || trendStrength !== 'marquée') {
      items.push({
        title: 'Les signaux sont constants et sans ambiguïté',
        weight: 24,
        description: "La semaine décrit une difficulté installée mais lisible, ce qui permet d'agir sur des causes identifiées plutôt que sur des impressions floues."
      });
    }

    if (hasFeedbacks) {
      items.push({
        title: 'Des retours concrets permettent de cibler les priorités',
        weight: 20,
        description: 'Les feedbacks remontés donnent une matière directement exploitable pour arbitrer les premières actions.'
      });
    }

    items.push({
      title: 'Un point de départ clair pour piloter le redressement',
      weight: 16,
      description: "Les irritants principaux ressortent nettement, ce qui évite de disperser les efforts d'amélioration."
    });

    return items;
  }

  if (analysisMode === 'healthy') {
    if (moodBand === 'positive' || moodBand === 'correcte') {
      items.push({
        title: moodBand === 'positive' ? 'Ambiance globalement positive' : 'Ambiance globalement correcte',
        weight: moodBand === 'positive' ? 35 : 28,
        description: "Le climat d'équipe reste sain, lisible et sans signal d’alerte marqué."
      });
    }

    if (participationRate >= 85) {
      items.push({
        title: 'Participation élevée et régulière',
        weight: 30,
        description: "L'équipe répond largement présente sur la semaine, ce qui confirme une dynamique d'engagement stable."
      });
    }

    if (trend === 'stable' || trend === 'hausse' || trendStrength === 'faible') {
      items.push({
        title: 'Dynamique stable sur la semaine',
        weight: 24,
        description: "Les variations restent limitées et la semaine se termine sans dégradation notable de l'ambiance."
      });
    }

    if (hasFeedbacks) {
      items.push({
        title: 'Feedbacks exploitables remontés cette semaine',
        weight: 18,
        description: 'Les retours disponibles restent constructifs et peuvent nourrir des ajustements fins plutôt que des corrections lourdes.'
      });
    }

    topCauseWeights.forEach((item) => {
      if (positiveCauseMap[item.cause] && !excluded.has(item.cause) && item.weight >= 12) {
        items.push({
          title: positiveCauseMap[item.cause],
          weight: Math.max(14, Math.min(22, item.weight - 4)),
          description: `Le collectif conserve un appui visible sur ${item.label}.`
        });
      }
    });

    return items;
  }

  if (participationRate >= 85) {
    items.push({
      title: 'Participation élevée et régulière',
      weight: 30,
      description: "L'équipe répond largement présente sur la semaine, ce qui rend les signaux plus fiables."
    });
  }

  if (moodBand === 'positive' || moodBand === 'correcte') {
    items.push({
      title: moodBand === 'positive' ? 'Ambiance globalement positive' : 'Ambiance globalement correcte',
      weight: moodBand === 'positive' ? 32 : 24,
      description: "Le climat d'équipe reste exploitable sans signal d’alerte fort."
    });
  }

  if (trend === 'stable' || trendStrength === 'faible') {
    items.push({
      title: "Stabilité de l'ambiance sur la semaine",
      weight: 22,
      description: 'Les variations journalières restent limitées, ce qui traduit un socle collectif relativement homogène.'
    });
  }

  if (moodBand === 'correcte' && trend !== 'baisse') {
    items.push({
      title: 'Climat encore maîtrisé malgré les tensions',
      weight: 20,
      description: "La semaine reste pilotable, sans rupture nette dans la dynamique collective."
    });
  }

  topCauseWeights.forEach((item) => {
    if (positiveCauseMap[item.cause] && !excluded.has(item.cause)) {
      items.push({
        title: positiveCauseMap[item.cause],
        weight: Math.max(14, Math.min(24, item.weight - 5)),
        description: `Le collectif conserve encore des appuis sur ${item.label}.`
      });
    }
  });

  if (hasFeedbacks) {
    items.push({
      title: 'Feedbacks exploitables remontés cette semaine',
      weight: 18,
      description: 'Les retours disponibles donnent de la matière concrète pour piloter les actions.'
    });
  }

  return items;
};

const getWeaknessCandidates = ({ topCauseWeights, trend, trendStrength, feedbackLabels, analysisMode }) => {
  const items = [];

  if (analysisMode === 'healthy') {
    topCauseWeights.slice(0, 3).forEach((item) => {
      const titleMap = {
        WORKLOAD: 'Charge à surveiller si le rythme monte',
        BALANCE: 'Équilibre à préserver sur les semaines chargées',
        RECOGNITION: 'Reconnaissance à maintenir dans la durée',
        CLARITY: 'Clarté à consolider sur les priorités fines',
        MOTIVATION: 'Motivation à entretenir malgré la routine',
        RELATIONS: "Qualité de coopération à préserver"
      };
      const descriptionMap = {
        WORKLOAD: "La charge n'est pas alarmante à ce stade, mais elle mérite d'être surveillée pour éviter un tassement inutile.",
        BALANCE: "L'équilibre vie pro / vie perso reste correct, avec un besoin de vigilance légère sur les périodes plus denses.",
        RECOGNITION: 'La dynamique est bonne, mais la reconnaissance doit rester visible pour éviter une érosion progressive.',
        CLARITY: "Les repères sont globalement bons, avec quelques marges de progrès pour fluidifier les arbitrages fins.",
        MOTIVATION: "L'engagement reste présent, mais il gagne à être entretenu pour éviter un essoufflement discret.",
        RELATIONS: "Les relations semblent saines, avec un intérêt à conserver des rituels simples de coordination."
      };

      items.push({
        title: titleMap[item.cause] || `Point de vigilance autour de ${item.label}`,
        weight: Math.max(8, Math.min(18, item.weight - 6)),
        description:
          descriptionMap[item.cause] ||
          `${item.label.charAt(0).toUpperCase()}${item.label.slice(1)} reste davantage un point de vigilance qu'un irritant fort sur cette période.`
      });
    });

    if (Object.keys(feedbackLabels).length > 0) {
      Object.entries(feedbackLabels).slice(0, 2).forEach(([label, count]) => {
        items.push({
          title: `Sujet ponctuel remonté autour de ${label}`,
          weight: Math.min(16, 8 + count * 3),
          description: `Les retours agrégés mentionnent ${label}, sans en faire un signal critique à ce stade.`
        });
      });
    }

    if (trend === 'baisse') {
      items.push({
        title: "Légère érosion à surveiller en fin de semaine",
        weight: trendStrength === 'marquée' ? 18 : 12,
        description: "Le niveau global reste bon, mais un léger tassement mérite d'être observé avant qu'il ne s'installe."
      });
    }

    return items;
  }

  topCauseWeights.forEach((item) => {
    items.push({
      title: weaknessCauseMap[item.cause] || `Signal d'attention autour de ${item.label}`,
      weight: Math.max(10, item.weight),
      description:
        weaknessCauseDescriptions[item.cause] ||
        `${item.label.charAt(0).toUpperCase()}${item.label.slice(1)} reste un facteur de tension à surveiller cette semaine.`
    });
  });

  if (trend === 'baisse') {
    items.push({
      title: "Tassement de l'ambiance en cours de semaine",
      weight: trendStrength === 'marquée' ? 24 : 16,
      description: "La semaine montre une dégradation mesurée de l'humeur, à surveiller avant qu’elle ne s’installe."
    });
  }

  Object.entries(feedbackLabels).forEach(([label, count]) => {
    items.push({
      title: `Retours récurrents liés à ${label}`,
      weight: Math.min(25, 10 + count * 5),
      description: `Les feedbacks agrégés font remonter ${label} comme sujet récurrent cette semaine.`
    });
  });

  return items;
};

const getExcludedWeaknessCauses = (topCauseWeights) =>
  topCauseWeights
    .filter((item, index) => index < 3 || item.weight >= 18)
    .map((item) => item.cause);

const dedupeByTitle = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.title.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildFallbackStrengths = (context) => {
  const excludedCauses = getExcludedWeaknessCauses(context.topCauseWeights);
  const base = dedupeByTitle(getStrengthCandidates({
    ...context,
    excludedCauses
  }))
    .sort((a, b) => b.weight - a.weight || a.title.localeCompare(b.title))
    .slice(0, 3);

  while (base.length < 3) {
    base.push({
      title: `Point fort complémentaire ${base.length + 1}`,
      weight: 10,
      description: "Le collectif conserve des points d'appui malgré les tensions observées."
    });
  }

  return base.map((item, index) => ({
      rank: index + 1,
      title: item.title,
      weight: clampWeight(item.weight),
      description: item.description
    }));
};

const buildFallbackWeaknesses = (context) => {
  const base = getWeaknessCandidates(context)
    .sort((a, b) => b.weight - a.weight || a.title.localeCompare(b.title))
    .slice(0, 5);

  while (base.length < 5) {
    base.push({
      title: `Point d'attention complémentaire ${base.length + 1}`,
      weight: 0,
      description: "Aucun signal critique supplémentaire n'émerge sur cette période."
    });
  }

  return base.map((item, index) => ({
    rank: index + 1,
    title: item.title,
    weight: clampWeight(item.weight),
    description: item.description
  }));
};

const buildAnalysisContext = ({ weekStart, weekEnd, teamSize, metrics, feedbackLabels, topCauseWeights, moodBuckets, trendSummary }) => ({
  weekStart,
  weekEnd,
  teamSize,
  activeMembers: metrics.participation,
  averageMood: metrics.averageMood,
  moodBand: getMoodBand(metrics.averageMood),
  analysisMode: getAnalysisMode({
    averageMood: metrics.averageMood,
    participationRate: metrics.participationRate,
    trend: trendSummary.trend
  }),
  participationRate: metrics.participationRate,
  trend: trendSummary.trend,
  trendStrength: trendSummary.strength,
  lowestDay: trendSummary.lowestDay,
  highestDay: trendSummary.highestDay,
  trendSummary: trendSummary.summary,
  moodBuckets,
  topCauseWeights,
  feedbackCategories: feedbackLabels,
  positiveSignals: buildFallbackStrengths({
    analysisMode: getAnalysisMode({
      averageMood: metrics.averageMood,
      participationRate: metrics.participationRate,
      trend: trendSummary.trend
    }),
    participationRate: metrics.participationRate,
    moodBand: getMoodBand(metrics.averageMood),
    trend: trendSummary.trend,
    trendStrength: trendSummary.strength,
    topCauseWeights,
    feedbackLabels
  }),
  negativeSignals: buildFallbackWeaknesses({
    analysisMode: getAnalysisMode({
      averageMood: metrics.averageMood,
      participationRate: metrics.participationRate,
      trend: trendSummary.trend
    }),
    topCauseWeights,
    trend: trendSummary.trend,
    trendStrength: trendSummary.strength,
    feedbackLabels
  })
});

const normalizeCatalogSelection = ({ selection, catalog, type }) => {
  const catalogById = getCatalogById(catalog);
  const normalized = [];
  const seenIds = new Set();

  selection.forEach((item) => {
    const catalogItem = catalogById[item.id];
    if (!catalogItem) return;
    if (seenIds.has(catalogItem.id)) return;
    seenIds.add(catalogItem.id);

    if (type === 'action') {
      normalized.push({
        id: catalogItem.id,
        title: catalogItem.title,
        priority: catalogItem.priorityLabel,
        estimatedImpact: catalogItem.expectedImpactLabel,
        summary: item.summary,
        checklist: catalogItem.checklist
      });
      return;
    }

    normalized.push({
      id: catalogItem.id,
      title: catalogItem.title,
      estimatedImpact: catalogItem.expectedImpactLabel,
      objective: catalogItem.objective,
      format: catalogItem.format,
      bullets: catalogItem.bullets,
      benefit: catalogItem.benefitLabel
    });
  });

  return normalized;
};

const buildFallbackActionSelection = ({ topCauseWeights, analysisMode }) => {
  if (analysisMode === 'healthy') {
    return [
      {
        id: 'recognition-routine',
        summary: 'Consolider les bons signaux en gardant une reconnaissance visible et régulière dans le rythme habituel.'
      },
      {
        id: 'restore-clarity',
        summary: "Maintenir des repères simples sur les priorités pour éviter que la qualité d'exécution ne se dégrade avec le temps."
      },
      {
        id: 'protect-balance',
        summary: "Préserver les équilibres actuels pour que la charge ne vienne pas fragiliser une dynamique aujourd'hui saine."
      },
      {
        id: 'prevent-burnout',
        summary: "Garder quelques garde-fous simples pour détecter tôt toute dérive de fatigue avant qu'elle ne s'installe."
      }
    ];
  }

  const desired = [];
  const causes = topCauseWeights.map((item) => item.cause);

  if (causes.includes('WORKLOAD')) desired.push('reduce-workload');
  if (causes.includes('BALANCE')) desired.push('protect-balance');
  if (causes.includes('RECOGNITION')) desired.push('recognition-routine');
  if (causes.includes('CLARITY') || causes.includes('MOTIVATION')) desired.push('restore-clarity');
  if (causes.includes('WORKLOAD') || causes.includes('BALANCE') || causes.includes('MOTIVATION')) desired.push('prevent-burnout');

  ['reduce-workload', 'protect-balance', 'recognition-routine', 'restore-clarity', 'prevent-burnout'].forEach((id) => {
    if (!desired.includes(id)) desired.push(id);
  });

  const actionSummaryById = {
    'reduce-workload': "Réduire la dispersion pour redonner de l'air et de la lisibilité à l'équipe.",
    'protect-balance': "Mieux protéger les temps de récupération pour éviter que la tension ne s'installe.",
    'recognition-routine': 'Rendre les efforts plus visibles pour soutenir la motivation et les liens entre collègues.',
    'restore-clarity': 'Donner des repères plus nets pour limiter le flou et renforcer le sens du travail.',
    'prevent-burnout': "Installer des garde-fous simples pour contenir l'usure avant qu'elle ne monte."
  };

  return Array.from(new Set(desired)).slice(0, 4).map((id) => ({
    id,
    summary: actionSummaryById[id]
  }));
};

const buildFallbackActivitySelection = ({ topCauseWeights, analysisMode }) => {
  if (analysisMode === 'healthy') {
    return [
      {
        id: 'recognition-icebreaker',
        summary: 'Pertinent pour entretenir les liens et la reconnaissance sans introduire de lourdeur inutile dans une équipe déjà saine.'
      },
      {
        id: 'solution-retro',
        summary: "À utiliser de façon légère pour garder un espace d'ajustement continu sans dramatiser la situation."
      },
      {
        id: 'low-pressure-offsite',
        summary: 'Utile comme activité de respiration ponctuelle, en complément d’un pilotage déjà stable.'
      }
    ];
  }

  const ids = [];
  const causes = topCauseWeights.map((item) => item.cause);

  if (causes.includes('CLARITY') || causes.includes('WORKLOAD')) ids.push('solution-retro');
  if (causes.includes('RECOGNITION') || causes.includes('RELATIONS')) ids.push('recognition-icebreaker');
  if (causes.includes('BALANCE') || causes.includes('MOTIVATION') || causes.includes('WORKLOAD')) ids.push('low-pressure-offsite');

  ['solution-retro', 'recognition-icebreaker', 'low-pressure-offsite'].forEach((id) => {
    if (!ids.includes(id)) ids.push(id);
  });

  const activitySummaryById = {
    'solution-retro': "À privilégier quand l'équipe a besoin de transformer les irritants en décisions concrètes.",
    'recognition-icebreaker': 'Pertinent pour recréer rapidement de la reconnaissance sans lourdeur organisationnelle.',
    'low-pressure-offsite': 'Utile en complément pour relâcher la pression, jamais en remplacement du traitement des causes.'
  };

  return Array.from(new Set(ids)).slice(0, 3).map((id) => ({
    id,
    summary: activitySummaryById[id]
  }));
};

const normalizeAnalysisReport = ({ llmReport, context }) => {
  const fallbackStrengths = buildFallbackStrengths({
    analysisMode: context.analysisMode,
    participationRate: context.participationRate,
    moodBand: context.moodBand,
    trend: context.trend,
    trendStrength: context.trendStrength,
    topCauseWeights: context.topCauseWeights,
    feedbackLabels: context.feedbackCategories
  });
  const fallbackWeaknesses = buildFallbackWeaknesses({
    analysisMode: context.analysisMode,
    topCauseWeights: context.topCauseWeights,
    trend: context.trend,
    trendStrength: context.trendStrength,
    feedbackLabels: context.feedbackCategories
  });
  const fallbackActions = buildFallbackActionSelection({
    topCauseWeights: context.topCauseWeights,
    analysisMode: context.analysisMode
  });
  const fallbackActivities = buildFallbackActivitySelection({
    topCauseWeights: context.topCauseWeights,
    analysisMode: context.analysisMode
  });

  const parsed = AnalysisReportSchema.safeParse(llmReport);
  if (!parsed.success) {
    return {
      strengths: fallbackStrengths,
      weaknesses: fallbackWeaknesses,
      recommendedActions: normalizeCatalogSelection({
        selection: fallbackActions,
        catalog: actionCatalog,
        type: 'action'
      }),
      teamActivities: normalizeCatalogSelection({
        selection: fallbackActivities,
        catalog: activityCatalog,
        type: 'activity'
      })
    };
  }

  const actionSelection = normalizeCatalogSelection({
    selection: parsed.data.recommendedActions,
    catalog: actionCatalog,
    type: 'action'
  });
  const activitySelection = normalizeCatalogSelection({
    selection: parsed.data.teamActivities,
    catalog: activityCatalog,
    type: 'activity'
  });

  const recommendedActions = [...actionSelection];
  for (const item of normalizeCatalogSelection({ selection: fallbackActions, catalog: actionCatalog, type: 'action' })) {
    if (recommendedActions.length >= 4) break;
    if (!recommendedActions.some((entry) => entry.id === item.id)) recommendedActions.push(item);
  }

  const teamActivities = [...activitySelection];
  for (const item of normalizeCatalogSelection({ selection: fallbackActivities, catalog: activityCatalog, type: 'activity' })) {
    if (teamActivities.length >= 3) break;
    if (!teamActivities.some((entry) => entry.id === item.id)) teamActivities.push(item);
  }

  return {
    strengths: fallbackStrengths,
    weaknesses: fallbackWeaknesses,
    recommendedActions,
    teamActivities
  };
};

const buildEmptyAnalysisReport = ({ weekStart, weekEnd, teamId }) => ({
  weekStart,
  weekEnd,
  teamId,
  generated: false,
  overview: {
    moodBand: 'sans donnée exploitable',
    averageMood: null,
    participationRate: 0,
    trend: 'stable',
    trendStrength: 'faible'
  },
  strengths: [],
  weaknesses: [],
  recommendedActions: [],
  teamActivities: []
});

const attachAnalysisReportMeta = ({ payload, fromCache, generationCount, generatedAt, canRegenerate }) => ({
  ...payload,
  reportMeta: {
    fromCache,
    generationCount,
    generationLimit: WEEKLY_REPORT_GENERATION_LIMIT,
    canRegenerate: typeof canRegenerate === 'boolean'
      ? canRegenerate
      : generationCount < WEEKLY_REPORT_GENERATION_LIMIT,
    generatedAt: generatedAt || null
  }
});

const serializeAnalysisReportPayload = (payload) => ({
  weekStart: payload.weekStart,
  weekEnd: payload.weekEnd,
  teamId: payload.teamId,
  generated: payload.generated,
  overview: payload.overview,
  strengths: payload.strengths,
  weaknesses: payload.weaknesses,
  recommendedActions: payload.recommendedActions,
  teamActivities: payload.teamActivities
});

const serializeTeamInsightPayload = (payload) => ({
  weekStart: payload.weekStart,
  weekEnd: payload.weekEnd,
  teamId: payload.teamId,
  generated: payload.generated,
  summaryText: payload.summaryText,
  metrics: payload.metrics
});

const getWeeklyParticipationRateForTeam = async ({ teamId, start, end, teamSize }) => {
  if (!teamId || !teamSize) return 0;

  const activeMemberCount = await teamRepository.getActiveMemberCountByDateRange(
    teamId,
    toDateOnly(start),
    toDateOnly(end)
  );

  return Math.round((activeMemberCount * 100) / teamSize);
};

const enrichTeamInsightMetrics = async ({ teamId, start, metrics }) => {
  const memberRows = await teamRepository.getMemberIdsByTeam(teamId);
  const teamSize = memberRows.length;
  const previousStart = new Date(start);
  previousStart.setUTCDate(previousStart.getUTCDate() - 7);
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 3);

  return {
    ...metrics,
    previousParticipationRate: await getWeeklyParticipationRateForTeam({
      teamId,
      start: previousStart,
      end: previousEnd,
      teamSize
    })
  };
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

  const summary = buildWeeklySummarySnapshot({
    start,
    end,
    period,
    dailyRows,
    rawRows
  });

  let dashboard;
  if (period === 'week') {
    const previousStart = new Date(start);
    previousStart.setUTCDate(previousStart.getUTCDate() - 7);
    const previousEnd = new Date(end);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 7);

    let previousDailyRows = [];
    let previousRawRows = [];
    if (teamId) {
      [previousDailyRows, previousRawRows] = await Promise.all([
        teamRepository.getByDateRange(teamId, toDateOnly(previousStart), toDateOnly(previousEnd)),
        teamRepository.getByDateRangeWithCauses(teamId, toDateOnly(previousStart), toDateOnly(previousEnd))
      ]);
    }

    const previousSummary = buildWeeklySummarySnapshot({
      start: previousStart,
      end: previousEnd,
      period,
      dailyRows: previousDailyRows,
      rawRows: previousRawRows
    });

    dashboard = buildWeeklyDashboard({
      current: summary.dashboardMetrics,
      previous: previousSummary.dashboardMetrics
    });
  }

  return {
    weekStart: rangeStartStr,
    weekEnd: rangeEndStr,
    period,
    participation: summary.participation,
    averageMood: summary.averageMood,
    daily: summary.daily,
    stats: summary.stats,
    ...(dashboard ? { dashboard } : {})
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

const getWeeklyInsight = async ({ userId, queryTeamId, weekStart }) => {
  assertValidWeekStart(weekStart);
  const period = 'week';
  const { start, end } = getPeriodRange({ period, weekStart });
  const rangeStartStr = toDateOnly(start);
  const rangeEndStr = toDateOnly(end);
  const teamId = await resolveTeamIdForUser({ userId, queryTeamId });

  if (!teamId) {
    return {
      weekStart: rangeStartStr,
      weekEnd: rangeEndStr,
      teamId: null,
      generated: false,
      summaryText: null,
      metrics: { ...EMPTY_INSIGHT_METRICS }
    };
  }

  const existingInsight = await teamWeeklyReportRepository.getByScope({
    teamId,
    weekStart: rangeStartStr,
    reportType: REPORT_TYPE_WEEKLY_TEAM_INSIGHT
  });

  if (existingInsight) {
    return {
      ...existingInsight.payload,
      metrics: await enrichTeamInsightMetrics({
        teamId,
        start,
        metrics: {
          ...EMPTY_INSIGHT_METRICS,
          ...(existingInsight.payload.metrics || {})
        }
      })
    };
  }

  const previousStart = new Date(start);
  previousStart.setUTCDate(previousStart.getUTCDate() - 7);
  const previousEnd = new Date(end);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 7);

  const [memberRows, activeMemberCount, previousActiveMemberCount, dailyRows, rawRows, feedbackCategoryRows] = await Promise.all([
    teamRepository.getMemberIdsByTeam(teamId),
    teamRepository.getActiveMemberCountByDateRange(teamId, rangeStartStr, rangeEndStr),
    teamRepository.getActiveMemberCountByDateRange(teamId, toDateOnly(previousStart), toDateOnly(previousEnd)),
    teamRepository.getByDateRange(teamId, rangeStartStr, rangeEndStr),
    teamRepository.getByDateRangeWithCauses(teamId, rangeStartStr, rangeEndStr),
    feedbackRepository.getWeeklyCategoryCountsByTeam(teamId, rangeStartStr, rangeEndStr)
  ]);

  if (rawRows.length === 0) {
    return {
      weekStart: rangeStartStr,
      weekEnd: rangeEndStr,
      teamId,
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
      moodByDate[row.date] = Number(row.moodValue.toFixed(1));
    }
  });

  const stats = createWeeklyStats();
  const dailyResult = buildDailyForWeek({ start, moodByDate, stats });
  const teamSize = memberRows.length;
  const publicDaily = dailyResult.daily.map((entry) => ({
    date: entry.date,
    moodValue: entry.moodValue === null || entry.moodValue === undefined ? null : Number((entry.moodValue / 10).toFixed(1)),
    label: entry.label
  }));
  const trendSummary = getDailyTrendSummary(publicDaily);
  const metrics = {
    averageMood: moodCount ? Number((moodTotal / moodCount / 10).toFixed(1)) : null,
    participation: activeMemberCount,
    participationRate: teamSize ? Math.round((activeMemberCount * 100) / teamSize) : 0,
    previousParticipationRate: teamSize ? Math.round((previousActiveMemberCount * 100) / teamSize) : 0,
    topCauses,
    feedbackCategories,
    daily: publicDaily
  };
  const feedbackLabels = Object.entries(feedbackCategories).reduce((acc, [category, count]) => {
    acc[FEEDBACK_CATEGORY_LABELS[category] || category.toLowerCase()] = count;
    return acc;
  }, {});
  const insightContext = {
    teamSize,
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
    teamId,
    generated: true,
    summaryText: null,
    metrics
  };

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const lockedInsight = await teamWeeklyReportRepository.getByScopeForUpdate({
      teamId,
      weekStart: rangeStartStr,
      reportType: REPORT_TYPE_WEEKLY_TEAM_INSIGHT,
      client
    });

    if (lockedInsight) {
      await client.query('COMMIT');
      return lockedInsight.payload;
    }

    payload.summaryText = await groqClient.generateTeamWeeklyInsight({
      weekStart: rangeStartStr,
      weekEnd: rangeEndStr,
      metrics,
      insightContext
    });

    await teamWeeklyReportRepository.createReport({
      id: uuidv4(),
      teamId,
      weekStart: rangeStartStr,
      weekEnd: rangeEndStr,
      reportType: REPORT_TYPE_WEEKLY_TEAM_INSIGHT,
      payload: serializeTeamInsightPayload(payload),
      generationCount: 1,
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
      console.error('Erreur lors du rollback team weekly insight:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
};

const getWeeklyAnalysisReport = async ({ userId, userRole, queryTeamId, weekStart, forceRegenerate = false }) => {
  assertValidWeekStart(weekStart);
  const period = 'week';
  const { start, end } = getPeriodRange({ period, weekStart });
  const rangeStartStr = toDateOnly(start);
  const rangeEndStr = toDateOnly(end);
  const teamId = await resolveTeamIdForAnalysisReport({ userId, userRole, queryTeamId });

  if (!teamId) {
    return attachAnalysisReportMeta({
      payload: buildEmptyAnalysisReport({ weekStart: rangeStartStr, weekEnd: rangeEndStr, teamId: null }),
      fromCache: false,
      generationCount: 0,
      generatedAt: null,
      canRegenerate: false
    });
  }

  const existingReport = await teamWeeklyReportRepository.getByScope({
    teamId,
    weekStart: rangeStartStr
  });

  if (existingReport && !forceRegenerate) {
    return attachAnalysisReportMeta({
      payload: existingReport.payload,
      fromCache: true,
      generationCount: existingReport.generationCount,
      generatedAt: existingReport.generatedAt
    });
  }

  if (existingReport && existingReport.generationCount >= WEEKLY_REPORT_GENERATION_LIMIT) {
    return attachAnalysisReportMeta({
      payload: existingReport.payload,
      fromCache: true,
      generationCount: existingReport.generationCount,
      generatedAt: existingReport.generatedAt
    });
  }

  const [memberRows, activeMemberCount, dailyRows, rawRows, feedbackCategoryRows] = await Promise.all([
    teamRepository.getMemberIdsByTeam(teamId),
    teamRepository.getActiveMemberCountByDateRange(teamId, rangeStartStr, rangeEndStr),
    teamRepository.getByDateRange(teamId, rangeStartStr, rangeEndStr),
    teamRepository.getByDateRangeWithCauses(teamId, rangeStartStr, rangeEndStr),
    feedbackRepository.getWeeklyCategoryCountsByTeam(teamId, rangeStartStr, rangeEndStr)
  ]);

  if (rawRows.length === 0) {
    return attachAnalysisReportMeta({
      payload: buildEmptyAnalysisReport({ weekStart: rangeStartStr, weekEnd: rangeEndStr, teamId }),
      fromCache: false,
      generationCount: 0,
      generatedAt: null,
      canRegenerate: false
    });
  }

  const feedbackCategories = {};
  feedbackCategoryRows.forEach((row) => {
    feedbackCategories[row.category] = row.count;
  });

  const causeCounts = {};
  const moodValues = [];
  let moodTotal = 0;
  let moodCount = 0;

  rawRows.forEach((row) => {
    if (row.moodValue !== null && row.moodValue !== undefined) {
      moodTotal += row.moodValue;
      moodCount += 1;
      moodValues.push(row.moodValue);
    }

    const causes = parseCauses(row.causes).filter((cause) => VALID_CAUSES.includes(cause));
    causes.forEach((cause) => {
      causeCounts[cause] = (causeCounts[cause] || 0) + 1;
    });
  });

  const topCauses = Object.keys(causeCounts)
    .sort((a, b) => causeCounts[b] - causeCounts[a] || a.localeCompare(b))
    .slice(0, 2);

  const moodByDate = {};
  dailyRows.forEach((row) => {
    if (row.moodValue !== null && row.moodValue !== undefined) {
      moodByDate[row.date] = Number(row.moodValue.toFixed(1));
    }
  });

  const stats = createWeeklyStats();
  const dailyResult = buildDailyForWeek({ start, moodByDate, stats });
  const publicDaily = dailyResult.daily.map((entry) => ({
    date: entry.date,
    moodValue: entry.moodValue === null || entry.moodValue === undefined ? null : Number((entry.moodValue / 10).toFixed(1)),
    label: entry.label
  }));
  const trendSummary = getDailyTrendSummary(publicDaily);
  const feedbackLabels = Object.entries(feedbackCategories).reduce((acc, [category, count]) => {
    acc[FEEDBACK_CATEGORY_LABELS[category] || category.toLowerCase()] = count;
    return acc;
  }, {});
  const topCauseWeights = getCauseWeights(causeCounts);
  const metrics = {
    averageMood: moodCount ? Number((moodTotal / moodCount / 10).toFixed(1)) : null,
    participation: activeMemberCount,
    participationRate: memberRows.length ? Math.round((activeMemberCount * 100) / memberRows.length) : 0,
    topCauses,
    feedbackCategories,
    daily: publicDaily
  };

  const analysisContext = buildAnalysisContext({
    weekStart: rangeStartStr,
    weekEnd: rangeEndStr,
    teamSize: memberRows.length,
    metrics,
    feedbackLabels,
    topCauseWeights,
    moodBuckets: getMoodBuckets(moodValues),
    trendSummary
  });

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const lockedReport = await teamWeeklyReportRepository.getByScopeForUpdate({
      teamId,
      weekStart: rangeStartStr,
      client
    });

    if (lockedReport && !forceRegenerate) {
      await client.query('COMMIT');
      return attachAnalysisReportMeta({
        payload: lockedReport.payload,
        fromCache: true,
        generationCount: lockedReport.generationCount,
        generatedAt: lockedReport.generatedAt
      });
    }

    if (lockedReport && lockedReport.generationCount >= WEEKLY_REPORT_GENERATION_LIMIT) {
      await client.query('COMMIT');
      return attachAnalysisReportMeta({
        payload: lockedReport.payload,
        fromCache: true,
        generationCount: lockedReport.generationCount,
        generatedAt: lockedReport.generatedAt
      });
    }

    const llmReport = await groqClient.generateTeamWeeklyAnalysisReport({
      context: analysisContext,
      actionCatalog,
      activityCatalog
    });
    const normalized = normalizeAnalysisReport({ llmReport, context: analysisContext });
    const payload = {
      weekStart: rangeStartStr,
      weekEnd: rangeEndStr,
      teamId,
      generated: true,
      overview: {
        moodBand: analysisContext.moodBand,
        averageMood: metrics.averageMood,
        participationRate: metrics.participationRate,
        trend: analysisContext.trend,
        trendStrength: analysisContext.trendStrength
      },
      strengths: normalized.strengths,
      weaknesses: normalized.weaknesses,
      recommendedActions: normalized.recommendedActions,
      teamActivities: normalized.teamActivities
    };

    const generatedAt = new Date().toISOString();

    if (!lockedReport) {
      await teamWeeklyReportRepository.createReport({
        id: uuidv4(),
        teamId,
        weekStart: rangeStartStr,
        weekEnd: rangeEndStr,
        payload: serializeAnalysisReportPayload(payload),
        generationCount: 1,
        generatedAt,
        createdByUserId: userId,
        updatedByUserId: userId,
        client
      });
      await client.query('COMMIT');
      return attachAnalysisReportMeta({
        payload,
        fromCache: false,
        generationCount: 1,
        generatedAt
      });
    }

    const nextGenerationCount = lockedReport.generationCount + 1;
    await teamWeeklyReportRepository.updateReport({
      reportId: lockedReport.id,
      weekEnd: rangeEndStr,
      payload: serializeAnalysisReportPayload(payload),
      generationCount: nextGenerationCount,
      generatedAt,
      updatedByUserId: userId,
      client
    });
    await client.query('COMMIT');

    return attachAnalysisReportMeta({
      payload,
      fromCache: false,
      generationCount: nextGenerationCount,
      generatedAt
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Erreur lors du rollback report cache:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  };
};

const createTeam = async ({ name, organizationId, userOrganizationId, userRole }) => {
  if (!['manager', 'admin'].includes(userRole)) {
    throw new AppError('Forbidden: manager or admin role required', 403, 'FORBIDDEN');
  }

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

const addMember = async ({ teamId, userId, userRole }) => {
  if (!['manager', 'admin'].includes(userRole)) {
    throw new AppError('Forbidden: manager or admin role required', 403, 'FORBIDDEN');
  }

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
  getWeeklyInsight,
  getWeeklyAnalysisReport,
  createTeam,
  addMember
};
