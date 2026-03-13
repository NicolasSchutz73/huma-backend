const test = require('node:test');
const assert = require('node:assert');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';

const teamRepository = require('../src/repositories/teamRepository');
const dbPool = require('../src/db/index');
const feedbackRepository = require('../src/repositories/feedbackRepository');
const teamWeeklyReportRepository = require('../src/repositories/teamWeeklyReportRepository');
const userRepository = require('../src/repositories/userRepository');
const groqClient = require('../src/services/groqClient');
const teamService = require('../src/services/teamService');
const { AppError } = require('../src/utils/errors');

const originalRepository = {
  isMember: teamRepository.isMember,
  getFirstTeamIdByUser: teamRepository.getFirstTeamIdByUser,
  getByDateRange: teamRepository.getByDateRange,
  getByDateRangeWithCauses: teamRepository.getByDateRangeWithCauses,
  getMemberIdsByTeam: teamRepository.getMemberIdsByTeam,
  getActiveMemberCountByDateRange: teamRepository.getActiveMemberCountByDateRange,
  getTeamById: teamRepository.getTeamById,
  createTeam: teamRepository.createTeam,
  addMember: teamRepository.addMember
};
const originalUserRepository = {
  getIdById: userRepository.getIdById
};
const originalFeedbackRepository = {
  getWeeklyCategoryCountsByTeam: feedbackRepository.getWeeklyCategoryCountsByTeam
};
const originalTeamWeeklyReportRepository = {
  getByScope: teamWeeklyReportRepository.getByScope,
  getByScopeForUpdate: teamWeeklyReportRepository.getByScopeForUpdate,
  createReport: teamWeeklyReportRepository.createReport,
  updateReport: teamWeeklyReportRepository.updateReport
};
const originalDbPool = {
  connect: dbPool.connect
};
const originalGroqClient = {
  generateTeamWeeklyInsight: groqClient.generateTeamWeeklyInsight,
  generateTeamWeeklyAnalysisReport: groqClient.generateTeamWeeklyAnalysisReport
};

test.afterEach(() => {
  teamRepository.isMember = originalRepository.isMember;
  teamRepository.getFirstTeamIdByUser = originalRepository.getFirstTeamIdByUser;
  teamRepository.getByDateRange = originalRepository.getByDateRange;
  teamRepository.getByDateRangeWithCauses = originalRepository.getByDateRangeWithCauses;
  teamRepository.getMemberIdsByTeam = originalRepository.getMemberIdsByTeam;
  teamRepository.getActiveMemberCountByDateRange = originalRepository.getActiveMemberCountByDateRange;
  teamRepository.getTeamById = originalRepository.getTeamById;
  teamRepository.createTeam = originalRepository.createTeam;
  teamRepository.addMember = originalRepository.addMember;
  userRepository.getIdById = originalUserRepository.getIdById;
  feedbackRepository.getWeeklyCategoryCountsByTeam = originalFeedbackRepository.getWeeklyCategoryCountsByTeam;
  teamWeeklyReportRepository.getByScope = originalTeamWeeklyReportRepository.getByScope;
  teamWeeklyReportRepository.getByScopeForUpdate = originalTeamWeeklyReportRepository.getByScopeForUpdate;
  teamWeeklyReportRepository.createReport = originalTeamWeeklyReportRepository.createReport;
  teamWeeklyReportRepository.updateReport = originalTeamWeeklyReportRepository.updateReport;
  dbPool.connect = originalDbPool.connect;
  groqClient.generateTeamWeeklyInsight = originalGroqClient.generateTeamWeeklyInsight;
  groqClient.generateTeamWeeklyAnalysisReport = originalGroqClient.generateTeamWeeklyAnalysisReport;
});

const createMockClient = () => {
  const queries = [];
  return {
    queries,
    async query(sql) {
      queries.push(sql);
      return { rows: [], rowCount: 0 };
    },
    release() {}
  };
};

const mockEmptyWeeklyReportCache = () => {
  const client = createMockClient();
  dbPool.connect = async () => client;
  teamWeeklyReportRepository.getByScope = async () => null;
  teamWeeklyReportRepository.getByScopeForUpdate = async () => null;
  teamWeeklyReportRepository.createReport = async () => {};
  teamWeeklyReportRepository.updateReport = async () => {};
  return client;
};

test('createTeam rejects employee role', async () => {
  await assert.rejects(
    teamService.createTeam({
      name: 'Equipe C',
      userOrganizationId: 'org-1',
      userRole: 'employee'
    }),
    (err) => err instanceof AppError && err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('createTeam allows manager role', async () => {
  let createTeamPayload = null;
  teamRepository.createTeam = async (payload) => {
    createTeamPayload = payload;
  };

  const result = await teamService.createTeam({
    name: 'Equipe C',
    userOrganizationId: 'org-1',
    userRole: 'manager'
  });

  assert.strictEqual(result.message, 'Équipe créée avec succès');
  assert.strictEqual(result.team.name, 'Equipe C');
  assert.strictEqual(result.team.organizationId, 'org-1');
  assert.ok(createTeamPayload.id);
  assert.strictEqual(createTeamPayload.name, 'Equipe C');
  assert.strictEqual(createTeamPayload.organizationId, 'org-1');
});

test('addMember rejects employee role', async () => {
  await assert.rejects(
    teamService.addMember({
      teamId: 'team-1',
      userId: 'user-2',
      userRole: 'employee'
    }),
    (err) => err instanceof AppError && err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('addMember allows admin role when team and user exist', async () => {
  let addMemberPayload = null;
  teamRepository.getTeamById = async () => ({ id: 'team-1' });
  userRepository.getIdById = async () => ({ id: 'user-2' });
  teamRepository.addMember = async (payload) => {
    addMemberPayload = payload;
  };

  const result = await teamService.addMember({
    teamId: 'team-1',
    userId: 'user-2',
    userRole: 'admin'
  });

  assert.strictEqual(result.message, 'Membre ajouté avec succès');
  assert.strictEqual(result.member.teamId, 'team-1');
  assert.strictEqual(result.member.userId, 'user-2');
  assert.ok(addMemberPayload.id);
  assert.strictEqual(addMemberPayload.teamId, 'team-1');
  assert.strictEqual(addMemberPayload.userId, 'user-2');
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
  assert.deepStrictEqual(result.dashboard, {
    averageMood: {
      value: null,
      deltaVsPreviousWeek: null
    },
    participation: {
      value: 0,
      deltaVsPreviousWeek: null
    },
    qvtBarometer: {
      value: null,
      deltaVsPreviousWeek: null,
      label: 'Indice annuel évolutif'
    }
  });
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
  teamRepository.getByDateRange = async (_teamId, startDate) => {
    if (startDate === '2026-02-16') {
      return [
        { date: '2026-02-16', moodValue: 70 },
        { date: '2026-02-18', moodValue: 55 }
      ];
    }
    return [
      { date: '2026-02-10', moodValue: 64 }
    ];
  };
  teamRepository.getByDateRangeWithCauses = async (_teamId, startDate) => {
    if (startDate === '2026-02-16') {
      return [
        { date: '2026-02-16', moodValue: 80, causes: '["WORKLOAD"]' },
        { date: '2026-02-16', moodValue: 60, causes: '["BALANCE"]' },
        { date: '2026-02-18', moodValue: 55, causes: '["RELATIONS"]' }
      ];
    }
    return [
      { date: '2026-02-10', moodValue: 64, causes: '["WORKLOAD"]' }
    ];
  };

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
  assert.deepStrictEqual(result.dashboard, {
    averageMood: {
      value: 6.5,
      deltaVsPreviousWeek: 0.1
    },
    participation: {
      value: 40,
      deltaVsPreviousWeek: 20
    },
    qvtBarometer: {
      value: 5.2,
      deltaVsPreviousWeek: 0,
      label: 'Indice annuel évolutif'
    }
  });
});

test('team weekly summary returns null dashboard deltas when previous week has no exploitable data', async () => {
  teamRepository.isMember = async () => true;
  teamRepository.getByDateRange = async (_teamId, startDate) => {
    if (startDate === '2026-02-16') {
      return [{ date: '2026-02-16', moodValue: 72 }];
    }
    return [];
  };
  teamRepository.getByDateRangeWithCauses = async (_teamId, startDate) => {
    if (startDate === '2026-02-16') {
      return [{ date: '2026-02-16', moodValue: 72, causes: '["WORKLOAD"]' }];
    }
    return [];
  };

  const result = await teamService.getWeeklySummary({
    userId: 'user-1',
    queryTeamId: 'team-1',
    period: 'week',
    weekStart: '2026-02-16'
  });

  assert.deepStrictEqual(result.dashboard, {
    averageMood: {
      value: 7.2,
      deltaVsPreviousWeek: null
    },
    participation: {
      value: 20,
      deltaVsPreviousWeek: null
    },
    qvtBarometer: {
      value: 5.8,
      deltaVsPreviousWeek: null,
      label: 'Indice annuel évolutif'
    }
  });
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
  let createdReport = null;

  const client = createMockClient();
  dbPool.connect = async () => client;
  teamWeeklyReportRepository.getByScope = async () => null;
  teamWeeklyReportRepository.getByScopeForUpdate = async () => null;
  teamWeeklyReportRepository.createReport = async (payload) => {
    createdReport = payload;
  };

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
  assert.ok(createdReport);
  assert.strictEqual(createdReport.reportType, 'weekly_team_insight');
  assert.strictEqual(createdReport.generationCount, 1);
  assert.deepStrictEqual(createdReport.payload, result);
  assert.ok(client.queries.includes('BEGIN'));
  assert.ok(client.queries.includes('COMMIT'));
});

test('team weekly insight returns empty metrics when the week has no data', async () => {
  teamWeeklyReportRepository.getByScope = async () => null;
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
  const client = createMockClient();
  dbPool.connect = async () => client;
  teamWeeklyReportRepository.getByScope = async () => null;
  teamWeeklyReportRepository.getByScopeForUpdate = async () => null;
  teamWeeklyReportRepository.createReport = async () => {
    throw new Error('should not persist on failure');
  };
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
  assert.ok(client.queries.includes('ROLLBACK'));
});

test('team weekly insight rejects impossible weekStart dates', async () => {
  await assert.rejects(
    teamService.getWeeklyInsight({
      userId: 'user-1',
      queryTeamId: 'team-1',
      weekStart: '2026-13-40'
    }),
    (err) =>
      err instanceof AppError &&
      err.status === 400 &&
      err.code === 'VALIDATION_ERROR' &&
      err.message === 'weekStart must be in YYYY-MM-DD format'
  );
});

test('team weekly insight returns cached payload without calling Groq', async () => {
  teamRepository.isMember = async () => true;
  teamWeeklyReportRepository.getByScope = async () => ({
    payload: {
      weekStart: '2026-02-16',
      weekEnd: '2026-02-20',
      teamId: 'team-1',
      generated: true,
      summaryText: 'Résumé déjà stocké',
      metrics: {
        averageMood: 7.1,
        participation: 4,
        participationRate: 80,
        topCauses: ['WORKLOAD'],
        feedbackCategories: {},
        daily: []
      }
    }
  });
  groqClient.generateTeamWeeklyInsight = async () => {
    throw new Error('should not call Groq when cache exists');
  };

  const result = await teamService.getWeeklyInsight({
    userId: 'user-1',
    queryTeamId: 'team-1',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.summaryText, 'Résumé déjà stocké');
});

test('team weekly analysis report rejects employee role', async () => {
  await assert.rejects(
    teamService.getWeeklyAnalysisReport({
      userId: 'user-1',
      userRole: 'employee',
      weekStart: '2026-02-16'
    }),
    (err) => err instanceof AppError && err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('team weekly analysis report requires teamId for admin', async () => {
  await assert.rejects(
    teamService.getWeeklyAnalysisReport({
      userId: 'admin-1',
      userRole: 'admin',
      weekStart: '2026-02-16'
    }),
    (err) => err instanceof AppError && err.status === 400 && err.code === 'VALIDATION_ERROR'
  );
});

test('team weekly analysis report rejects impossible weekStart dates', async () => {
  await assert.rejects(
    teamService.getWeeklyAnalysisReport({
      userId: 'manager-1',
      userRole: 'manager',
      queryTeamId: 'team-1',
      weekStart: '2026-13-40'
    }),
    (err) =>
      err instanceof AppError &&
      err.status === 400 &&
      err.code === 'VALIDATION_ERROR' &&
      err.message === 'weekStart must be in YYYY-MM-DD format'
  );
});

test('team weekly analysis report returns structured report for manager', async () => {
  let groqPayload = null;
  mockEmptyWeeklyReportCache();

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
    { date: '2026-02-19', userId: 'u3', moodValue: 71, causes: '["RECOGNITION"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByTeam = async () => [
    { category: 'RECOGNITION', count: 2 },
    { category: 'WORKLOAD', count: 1 }
  ];
  groqClient.generateTeamWeeklyAnalysisReport = async (payload) => {
    groqPayload = payload;
    return {
      strengths: [
        { rank: 1, title: 'Motivation globalement présente', weight: 35, description: 'La motivation semble solide.' },
        { rank: 2, title: 'Participation élevée et régulière', weight: 30, description: 'Participation forte.' },
        { rank: 3, title: 'Reconnaissance perçue dans les échanges', weight: 20, description: 'Signal positif sur la reconnaissance.' }
      ],
      weaknesses: [
        { rank: 1, title: 'Charge de travail excessive ou mal priorisée', weight: 30, description: 'Sujet principal.' },
        { rank: 2, title: 'Manque de reconnaissance', weight: 20, description: 'Sujet secondaire.' },
        { rank: 3, title: 'Tassement de l’ambiance en cours de semaine', weight: 15, description: 'Variation modérée.' },
        { rank: 4, title: 'Retours récurrents liés à la charge de travail', weight: 15, description: 'Feedbacks présents.' },
        { rank: 5, title: 'Retours récurrents liés à la reconnaissance', weight: 10, description: 'Feedbacks présents.' }
      ],
      recommendedActions: [
        { id: 'reduce-workload', summary: 'Réduire la pression court terme.' },
        { id: 'recognition-routine', summary: 'Rendre la reconnaissance plus visible.' },
        { id: 'restore-clarity', summary: 'Redonner des repères.' },
        { id: 'prevent-burnout', summary: 'Prévenir la fatigue.' }
      ],
      teamActivities: [
        { id: 'solution-retro', summary: 'Faire émerger des solutions.' },
        { id: 'recognition-icebreaker', summary: 'Renforcer la reconnaissance entre pairs.' },
        { id: 'low-pressure-offsite', summary: 'Créer un espace de décompression.' }
      ]
    };
  };

  const result = await teamService.getWeeklyAnalysisReport({
    userId: 'manager-1',
    userRole: 'manager',
    queryTeamId: 'team-1',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.generated, true);
  assert.strictEqual(result.overview.moodBand, 'correcte');
  assert.strictEqual(result.overview.participationRate, 80);
  assert.strictEqual(result.strengths.length, 3);
  assert.ok(result.strengths.some((item) => item.title === 'Ambiance globalement correcte'));
  assert.ok(
    result.strengths.some(
      (item) => item.title.includes('Stabilité') || item.title.includes('Climat encore maîtrisé')
    )
  );
  assert.ok(result.strengths.every((item) => !item.title.toLowerCase().includes('motivation')));
  assert.strictEqual(result.weaknesses.length, 5);
  assert.strictEqual(result.recommendedActions.length, 4);
  assert.strictEqual(result.teamActivities.length, 3);
  assert.deepStrictEqual(result.reportMeta, {
    fromCache: false,
    generationCount: 1,
    generationLimit: 2,
    canRegenerate: true,
    generatedAt: result.reportMeta.generatedAt
  });
  assert.ok(result.reportMeta.generatedAt);
  assert.strictEqual(result.recommendedActions[0].title, 'Clarifier et réduire la charge de travail');
  assert.strictEqual(result.teamActivities[0].objective, 'Faire émerger irritants et solutions concrètes');
  assert.ok(groqPayload);
  assert.strictEqual(groqPayload.context.feedbackCategories.reconnaissance, 2);
  assert.strictEqual(groqPayload.context.analysisMode, 'mixed');
});

test('team weekly analysis report softens weaknesses for healthy teams', async () => {
  mockEmptyWeeklyReportCache();
  teamRepository.isMember = async () => true;
  teamRepository.getMemberIdsByTeam = async () => [
    { user_id: 'u1' },
    { user_id: 'u2' },
    { user_id: 'u3' },
    { user_id: 'u4' }
  ];
  teamRepository.getActiveMemberCountByDateRange = async () => 4;
  teamRepository.getByDateRange = async () => [
    { date: '2026-03-02', moodValue: 80 },
    { date: '2026-03-03', moodValue: 81 },
    { date: '2026-03-04', moodValue: 79 },
    { date: '2026-03-05', moodValue: 82 },
    { date: '2026-03-06', moodValue: 81 }
  ];
  teamRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-03-02', userId: 'u1', moodValue: 80, causes: '["RECOGNITION","RELATIONS"]' },
    { date: '2026-03-03', userId: 'u2', moodValue: 81, causes: '["RECOGNITION"]' },
    { date: '2026-03-04', userId: 'u3', moodValue: 79, causes: '["RELATIONS"]' },
    { date: '2026-03-05', userId: 'u4', moodValue: 82, causes: '["CLARITY"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByTeam = async () => [
    { category: 'RECOGNITION', count: 1 }
  ];
  groqClient.generateTeamWeeklyAnalysisReport = async () => ({
    strengths: [
      { rank: 1, title: 'Très bonne ambiance', weight: 40, description: 'Texte LLM ignoré pour verrouiller le rendu.' },
      { rank: 2, title: 'Participation forte', weight: 30, description: 'Texte LLM ignoré pour verrouiller le rendu.' },
      { rank: 3, title: 'Relations solides', weight: 20, description: 'Texte LLM ignoré pour verrouiller le rendu.' }
    ],
    weaknesses: [
      { rank: 1, title: 'Friction relationnelle dans l’équipe', weight: 40, description: 'Trop sévère pour une équipe saine.' },
      { rank: 2, title: 'Fatigue motivationnelle', weight: 30, description: 'Trop sévère pour une équipe saine.' },
      { rank: 3, title: 'Manque de clarté et de sens', weight: 20, description: 'Trop sévère pour une équipe saine.' },
      { rank: 4, title: 'Charge de travail excessive ou mal priorisée', weight: 10, description: 'Trop sévère pour une équipe saine.' },
      { rank: 5, title: 'Déséquilibre vie pro / vie perso', weight: 5, description: 'Trop sévère pour une équipe saine.' }
    ],
    recommendedActions: [
      { id: 'recognition-routine', summary: 'Consolider la reconnaissance.' },
      { id: 'restore-clarity', summary: 'Conserver des repères clairs.' },
      { id: 'protect-balance', summary: 'Préserver les équilibres.' },
      { id: 'prevent-burnout', summary: 'Rester attentif aux signes faibles.' }
    ],
    teamActivities: [
      { id: 'recognition-icebreaker', summary: 'Entretenir les liens.' },
      { id: 'solution-retro', summary: 'Ajuster en continu.' },
      { id: 'low-pressure-offsite', summary: 'Respiration légère.' }
    ]
  });

  const result = await teamService.getWeeklyAnalysisReport({
    userId: 'manager-healthy',
    userRole: 'manager',
    queryTeamId: 'team-healthy',
    weekStart: '2026-03-02'
  });

  assert.strictEqual(result.overview.moodBand, 'positive');
  assert.ok(result.strengths.some((item) => item.title === 'Ambiance globalement positive'));
  assert.ok(result.weaknesses.every((item) => !item.title.includes('Friction relationnelle')));
  assert.ok(result.weaknesses.every((item) => !item.title.includes('Fatigue motivationnelle')));
  assert.ok(result.weaknesses.some((item) => item.title.includes('vigilance') || item.title.includes('Charge à surveiller') || item.title.includes('à préserver')));
});

test('team weekly analysis report reframes strengths as points of support for critical teams', async () => {
  mockEmptyWeeklyReportCache();
  teamRepository.isMember = async () => true;
  teamRepository.getMemberIdsByTeam = async () => [
    { user_id: 'u1' },
    { user_id: 'u2' },
    { user_id: 'u3' },
    { user_id: 'u4' }
  ];
  teamRepository.getActiveMemberCountByDateRange = async () => 4;
  teamRepository.getByDateRange = async () => [
    { date: '2026-03-02', moodValue: 33 },
    { date: '2026-03-03', moodValue: 34 },
    { date: '2026-03-04', moodValue: 30 },
    { date: '2026-03-05', moodValue: 32 },
    { date: '2026-03-06', moodValue: 35 }
  ];
  teamRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-03-02', userId: 'u1', moodValue: 33, causes: '["WORKLOAD","CLARITY"]' },
    { date: '2026-03-03', userId: 'u2', moodValue: 34, causes: '["WORKLOAD"]' },
    { date: '2026-03-04', userId: 'u3', moodValue: 30, causes: '["CLARITY","BALANCE"]' },
    { date: '2026-03-05', userId: 'u4', moodValue: 32, causes: '["BALANCE"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByTeam = async () => [
    { category: 'WORKLOAD', count: 1 },
    { category: 'WORK_LIFE_BALANCE', count: 1 }
  ];
  groqClient.generateTeamWeeklyAnalysisReport = async () => ({
    strengths: [
      { rank: 1, title: 'Ambiance très positive', weight: 40, description: 'Incohérent pour une équipe critique.' },
      { rank: 2, title: 'Motivation élevée', weight: 30, description: 'Incohérent pour une équipe critique.' },
      { rank: 3, title: 'Relations excellentes', weight: 20, description: 'Incohérent pour une équipe critique.' }
    ],
    weaknesses: [
      { rank: 1, title: 'Charge de travail excessive ou mal priorisée', weight: 30, description: 'Sujet principal.' },
      { rank: 2, title: 'Manque de clarté et de sens', weight: 25, description: 'Sujet secondaire.' },
      { rank: 3, title: 'Déséquilibre vie pro / vie perso', weight: 20, description: 'Sujet récurrent.' },
      { rank: 4, title: 'Fatigue motivationnelle', weight: 15, description: 'Sujet récurrent.' },
      { rank: 5, title: 'Retours récurrents liés à charge de travail', weight: 10, description: 'Feedbacks présents.' }
    ],
    recommendedActions: [
      { id: 'reduce-workload', summary: 'Réduire la dispersion.' },
      { id: 'protect-balance', summary: 'Protéger la récupération.' },
      { id: 'restore-clarity', summary: 'Redonner des repères.' },
      { id: 'prevent-burnout', summary: 'Limiter l’usure.' }
    ],
    teamActivities: [
      { id: 'solution-retro', summary: 'Faire émerger des solutions.' },
      { id: 'recognition-icebreaker', summary: 'Renforcer la reconnaissance.' },
      { id: 'low-pressure-offsite', summary: 'Relâcher la pression.' }
    ]
  });

  const result = await teamService.getWeeklyAnalysisReport({
    userId: 'manager-critical',
    userRole: 'manager',
    queryTeamId: 'team-critical',
    weekStart: '2026-03-02'
  });

  assert.strictEqual(result.overview.moodBand, 'très dégradée');
  assert.ok(result.strengths.every((item) => !item.title.toLowerCase().includes('positive')));
  assert.ok(result.strengths.some((item) => item.title.includes("L'équipe continue à répondre malgré la difficulté")));
  assert.ok(result.weaknesses.some((item) => item.title === 'Charge de travail excessive ou mal priorisée'));
});

test('team weekly analysis report allows admin with explicit teamId', async () => {
  teamWeeklyReportRepository.getByScope = async () => null;
  teamRepository.getTeamById = async () => 'team-1';
  teamRepository.getMemberIdsByTeam = async () => [];
  teamRepository.getActiveMemberCountByDateRange = async () => 0;
  teamRepository.getByDateRange = async () => [];
  teamRepository.getByDateRangeWithCauses = async () => [];
  feedbackRepository.getWeeklyCategoryCountsByTeam = async () => [];

  const result = await teamService.getWeeklyAnalysisReport({
    userId: 'admin-1',
    userRole: 'admin',
    queryTeamId: 'team-1',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.generated, false);
  assert.strictEqual(result.teamId, 'team-1');
  assert.deepStrictEqual(result.reportMeta, {
    fromCache: false,
    generationCount: 0,
    generationLimit: 2,
    canRegenerate: false,
    generatedAt: null
  });
});

test('team weekly analysis report returns cached report without calling Groq', async () => {
  teamRepository.isMember = async () => true;
  teamWeeklyReportRepository.getByScope = async () => ({
    id: 'report-1',
    payload: {
      weekStart: '2026-02-16',
      weekEnd: '2026-02-20',
      teamId: 'team-1',
      generated: true,
      overview: { moodBand: 'correcte', averageMood: 6.4, participationRate: 80, trend: 'stable', trendStrength: 'faible' },
      strengths: [{ rank: 1, title: 'S1', weight: 30, description: 'd1' }],
      weaknesses: [{ rank: 1, title: 'W1', weight: 30, description: 'd1' }],
      recommendedActions: [{ id: 'reduce-workload', title: 'A', priority: 'Critique', estimatedImpact: '+35%', summary: 's', checklist: ['a'] }],
      teamActivities: [{ id: 'solution-retro', title: 'T', estimatedImpact: '+15%', objective: 'o', format: 'f', bullets: ['a'], benefit: 'b' }]
    },
    generationCount: 1,
    generatedAt: '2026-02-21T09:30:00.000Z'
  });
  groqClient.generateTeamWeeklyAnalysisReport = async () => {
    throw new Error('should not be called');
  };

  const result = await teamService.getWeeklyAnalysisReport({
    userId: 'manager-1',
    userRole: 'manager',
    queryTeamId: 'team-1',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.reportMeta.fromCache, true);
  assert.strictEqual(result.reportMeta.generationCount, 1);
  assert.strictEqual(result.reportMeta.canRegenerate, true);
  assert.strictEqual(result.overview.averageMood, 6.4);
});

test('team weekly analysis report regenerates with forceRegenerate when quota remains', async () => {
  const client = createMockClient();
  dbPool.connect = async () => client;
  teamRepository.isMember = async () => true;
  teamRepository.getMemberIdsByTeam = async () => [{ user_id: 'u1' }, { user_id: 'u2' }];
  teamRepository.getActiveMemberCountByDateRange = async () => 2;
  teamRepository.getByDateRange = async () => [{ date: '2026-02-16', moodValue: 74 }];
  teamRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-02-16', userId: 'u1', moodValue: 74, causes: '["WORKLOAD"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByTeam = async () => [];
  teamWeeklyReportRepository.getByScope = async () => ({
    id: 'report-1',
    payload: {},
    generationCount: 1,
    generatedAt: '2026-02-20T10:00:00.000Z'
  });
  teamWeeklyReportRepository.getByScopeForUpdate = async () => ({
    id: 'report-1',
    payload: {},
    generationCount: 1,
    generatedAt: '2026-02-20T10:00:00.000Z'
  });
  let updatePayload = null;
  teamWeeklyReportRepository.updateReport = async (payload) => {
    updatePayload = payload;
  };
  groqClient.generateTeamWeeklyAnalysisReport = async () => ({
    strengths: [
      { rank: 1, title: 'S1', weight: 40, description: 'd1' },
      { rank: 2, title: 'S2', weight: 35, description: 'd2' },
      { rank: 3, title: 'S3', weight: 25, description: 'd3' }
    ],
    weaknesses: [
      { rank: 1, title: 'W1', weight: 30, description: 'd1' },
      { rank: 2, title: 'W2', weight: 25, description: 'd2' },
      { rank: 3, title: 'W3', weight: 20, description: 'd3' },
      { rank: 4, title: 'W4', weight: 15, description: 'd4' },
      { rank: 5, title: 'W5', weight: 10, description: 'd5' }
    ],
    recommendedActions: [
      { id: 'reduce-workload', summary: 'a1' },
      { id: 'restore-clarity', summary: 'a2' },
      { id: 'protect-balance', summary: 'a3' },
      { id: 'prevent-burnout', summary: 'a4' }
    ],
    teamActivities: [
      { id: 'solution-retro', summary: 't1' },
      { id: 'recognition-icebreaker', summary: 't2' },
      { id: 'low-pressure-offsite', summary: 't3' }
    ]
  });

  const result = await teamService.getWeeklyAnalysisReport({
    userId: 'manager-1',
    userRole: 'manager',
    queryTeamId: 'team-1',
    weekStart: '2026-02-16',
    forceRegenerate: true
  });

  assert.strictEqual(result.reportMeta.fromCache, false);
  assert.strictEqual(result.reportMeta.generationCount, 2);
  assert.strictEqual(result.reportMeta.canRegenerate, false);
  assert.strictEqual(updatePayload.generationCount, 2);
  assert.ok(client.queries.includes('BEGIN'));
  assert.ok(client.queries.includes('COMMIT'));
});

test('team weekly analysis report returns stored report when generation quota is exhausted', async () => {
  teamRepository.isMember = async () => true;
  teamWeeklyReportRepository.getByScope = async () => ({
    id: 'report-1',
    payload: {
      weekStart: '2026-02-16',
      weekEnd: '2026-02-20',
      teamId: 'team-1',
      generated: true,
      overview: { moodBand: 'correcte', averageMood: 6.4, participationRate: 80, trend: 'stable', trendStrength: 'faible' },
      strengths: [],
      weaknesses: [],
      recommendedActions: [],
      teamActivities: []
    },
    generationCount: 2,
    generatedAt: '2026-02-21T09:30:00.000Z'
  });
  groqClient.generateTeamWeeklyAnalysisReport = async () => {
    throw new Error('should not be called');
  };

  const result = await teamService.getWeeklyAnalysisReport({
    userId: 'manager-1',
    userRole: 'manager',
    queryTeamId: 'team-1',
    weekStart: '2026-02-16',
    forceRegenerate: true
  });

  assert.strictEqual(result.reportMeta.fromCache, true);
  assert.strictEqual(result.reportMeta.generationCount, 2);
  assert.strictEqual(result.reportMeta.canRegenerate, false);
});

test('team weekly analysis report maps Groq failures to AI_GENERATION_FAILED', async () => {
  const client = mockEmptyWeeklyReportCache();
  teamRepository.isMember = async () => true;
  teamRepository.getMemberIdsByTeam = async () => [{ user_id: 'u1' }];
  teamRepository.getActiveMemberCountByDateRange = async () => 1;
  teamRepository.getByDateRange = async () => [{ date: '2026-02-16', moodValue: 74 }];
  teamRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-02-16', userId: 'u1', moodValue: 74, causes: '["WORKLOAD"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByTeam = async () => [];
  let createCalled = false;
  let updateCalled = false;
  teamWeeklyReportRepository.createReport = async () => {
    createCalled = true;
  };
  teamWeeklyReportRepository.updateReport = async () => {
    updateCalled = true;
  };
  groqClient.generateTeamWeeklyAnalysisReport = async () => {
    throw new AppError('Groq returned invalid JSON', 502, 'AI_GENERATION_FAILED');
  };

  await assert.rejects(
    teamService.getWeeklyAnalysisReport({
      userId: 'manager-1',
    userRole: 'manager',
    queryTeamId: 'team-1',
    weekStart: '2026-02-16'
    }),
    (err) => err instanceof AppError && err.status === 502 && err.code === 'AI_GENERATION_FAILED'
  );
  assert.strictEqual(createCalled, false);
  assert.strictEqual(updateCalled, false);
  assert.ok(client.queries.includes('ROLLBACK'));
});

test('team weekly analysis report falls back when Groq report schema is invalid', async () => {
  mockEmptyWeeklyReportCache();
  teamRepository.isMember = async () => true;
  teamRepository.getMemberIdsByTeam = async () => [{ user_id: 'u1' }, { user_id: 'u2' }];
  teamRepository.getActiveMemberCountByDateRange = async () => 2;
  teamRepository.getByDateRange = async () => [
    { date: '2026-02-16', moodValue: 74 },
    { date: '2026-02-17', moodValue: 68 }
  ];
  teamRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-02-16', userId: 'u1', moodValue: 74, causes: '["WORKLOAD","CLARITY"]' },
    { date: '2026-02-17', userId: 'u2', moodValue: 68, causes: '["WORKLOAD"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByTeam = async () => [
    { category: 'WORKLOAD', count: 2 }
  ];
  groqClient.generateTeamWeeklyAnalysisReport = async () => ({
    strengths: [{ rank: 1, title: 'Malformed', weight: 50, description: 'Only one item.' }],
    weaknesses: [],
    recommendedActions: [],
    teamActivities: []
  });

  const result = await teamService.getWeeklyAnalysisReport({
    userId: 'manager-1',
    userRole: 'manager',
    queryTeamId: 'team-1',
    weekStart: '2026-02-16'
  });

  assert.strictEqual(result.generated, true);
  assert.strictEqual(result.strengths.length, 3);
  assert.strictEqual(result.weaknesses.length, 5);
  assert.strictEqual(result.recommendedActions.length, 4);
  assert.strictEqual(result.teamActivities.length, 3);
  assert.strictEqual(result.reportMeta.fromCache, false);
  assert.ok(result.weaknesses.some((item) => item.title === 'Charge de travail excessive ou mal priorisée'));
});

test('team weekly analysis report deduplicates repeated Groq catalog ids before filling fallback items', async () => {
  mockEmptyWeeklyReportCache();
  teamRepository.isMember = async () => true;
  teamRepository.getMemberIdsByTeam = async () => [{ user_id: 'u1' }, { user_id: 'u2' }];
  teamRepository.getActiveMemberCountByDateRange = async () => 2;
  teamRepository.getByDateRange = async () => [
    { date: '2026-02-16', moodValue: 74 },
    { date: '2026-02-17', moodValue: 68 }
  ];
  teamRepository.getByDateRangeWithCauses = async () => [
    { date: '2026-02-16', userId: 'u1', moodValue: 74, causes: '["WORKLOAD","CLARITY"]' },
    { date: '2026-02-17', userId: 'u2', moodValue: 68, causes: '["WORKLOAD","BALANCE"]' }
  ];
  feedbackRepository.getWeeklyCategoryCountsByTeam = async () => [
    { category: 'WORKLOAD', count: 2 }
  ];
  groqClient.generateTeamWeeklyAnalysisReport = async () => ({
    strengths: [
      { rank: 1, title: 'S1', weight: 40, description: 'd1' },
      { rank: 2, title: 'S2', weight: 35, description: 'd2' },
      { rank: 3, title: 'S3', weight: 25, description: 'd3' }
    ],
    weaknesses: [
      { rank: 1, title: 'W1', weight: 30, description: 'd1' },
      { rank: 2, title: 'W2', weight: 25, description: 'd2' },
      { rank: 3, title: 'W3', weight: 20, description: 'd3' },
      { rank: 4, title: 'W4', weight: 15, description: 'd4' },
      { rank: 5, title: 'W5', weight: 10, description: 'd5' }
    ],
    recommendedActions: [
      { id: 'reduce-workload', summary: 'a1' },
      { id: 'reduce-workload', summary: 'a2' },
      { id: 'restore-clarity', summary: 'a3' },
      { id: 'restore-clarity', summary: 'a4' }
    ],
    teamActivities: [
      { id: 'solution-retro', summary: 't1' },
      { id: 'solution-retro', summary: 't2' },
      { id: 'recognition-icebreaker', summary: 't3' }
    ]
  });

  const result = await teamService.getWeeklyAnalysisReport({
    userId: 'manager-1',
    userRole: 'manager',
    queryTeamId: 'team-1',
    weekStart: '2026-02-16'
  });

  assert.deepStrictEqual(
    result.recommendedActions.map((item) => item.id),
    ['reduce-workload', 'restore-clarity', 'protect-balance', 'prevent-burnout']
  );
  assert.deepStrictEqual(
    result.teamActivities.map((item) => item.id),
    ['solution-retro', 'recognition-icebreaker', 'low-pressure-offsite']
  );
});
