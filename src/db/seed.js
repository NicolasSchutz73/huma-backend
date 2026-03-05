const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./query');
const organizationRepository = require('../repositories/organizationRepository');
const userRepository = require('../repositories/userRepository');

const DEFAULT_ORG_NAME = 'Default Organization';
const DEFAULT_ADMIN_EMAIL = 'admin@local.test';
const DEFAULT_PASSWORD = 'adminadmin';
const DEMO_DAYS = 30;
const VALID_CAUSES = ['WORKLOAD', 'RELATIONS', 'MOTIVATION', 'CLARITY', 'RECOGNITION', 'BALANCE'];
const FEEDBACK_CATEGORIES = [
  'WORKLOAD',
  'RELATIONS',
  'MOTIVATION',
  'ORGANIZATION',
  'RECOGNITION',
  'WORK_LIFE_BALANCE',
  'FACILITIES'
];
const CAUSE_LABELS = {
  WORKLOAD: 'la charge de travail',
  RELATIONS: 'les relations dans l’équipe',
  MOTIVATION: 'la motivation',
  CLARITY: 'la clarté des priorités',
  RECOGNITION: 'la reconnaissance',
  BALANCE: "l'équilibre vie pro / vie perso"
};

const TEAM_DEMOS = [
  {
    key: 'healthy',
    name: 'Equipe A',
    managerEmail: 'manager1@local.test',
    employeeRange: [1, 10],
    scenarioLabel: 'équipe saine',
    workStyles: ['Collaboratif', 'Flexible'],
    motivationTypes: ['Impact', 'Apprentissage', 'Reconnaissance'],
    stressSources: ['Relations', 'Incertitude'],
    presenceRate: {
      manager: 1,
      employee: 0.93
    },
    baseMood: {
      manager: 82,
      employee: 76
    },
    dailyOffsets: {
      1: 1,
      2: 3,
      3: 2,
      4: 4,
      5: 5
    },
    weeklyTrend: 0.4,
    moodNoise: 5,
    causeWeights: [
      ['RECOGNITION', 0.28],
      ['RELATIONS', 0.24],
      ['MOTIVATION', 0.22],
      ['CLARITY', 0.12],
      ['BALANCE', 0.10],
      ['WORKLOAD', 0.04]
    ],
    feedbacks: [
      {
        email: 'manager1@local.test',
        offsetDays: 4,
        category: 'RECOGNITION',
        feedbackText:
          "L'équipe répond très bien aux feedbacks courts du manager. On gagnerait encore à ritualiser les réussites de la semaine.",
        solutionText:
          'Bloquer 10 minutes chaque vendredi pour partager les progrès visibles et remercier des contributions concrètes.'
      },
      {
        email: 'employee03@local.test',
        offsetDays: 8,
        category: 'FACILITIES',
        feedbackText:
          "Les temps de concentration se passent bien. Un espace un peu plus calme pour les appels clients rendrait l'organisation encore plus fluide.",
        solutionText:
          "Réserver un créneau quotidien dans une salle calme et afficher un planning simple pour éviter les conflits d'usage."
      },
      {
        email: 'employee06@local.test',
        offsetDays: 12,
        category: 'ORGANIZATION',
        feedbackText:
          "Les priorités sont globalement claires. Un mini point d'alignement du lundi aiderait à garder le bon rythme sur toute la semaine.",
        solutionText:
          "Mettre en place un point de 15 minutes le lundi matin avec trois priorités d'équipe visibles par tous."
      },
      {
        email: 'employee09@local.test',
        offsetDays: 17,
        category: 'RECOGNITION',
        feedbackText:
          "Quand les efforts sont reconnus rapidement, l'équipe garde une bonne énergie. Il faudrait garder cette habitude même pendant les semaines chargées.",
        solutionText:
          'Prévoir un rappel hebdomadaire pour valoriser un exemple concret de coopération et un résultat obtenu.'
      }
    ]
  },
  {
    key: 'struggling',
    name: 'Equipe B',
    managerEmail: 'manager2@local.test',
    employeeRange: [11, 20],
    scenarioLabel: 'équipe sous tension',
    workStyles: ['Structuré', 'Autonome'],
    motivationTypes: ['Équilibre', 'Reconnaissance', 'Impact'],
    stressSources: ['Charge de travail', 'Délais', 'Incertitude'],
    presenceRate: {
      manager: 0.9,
      employee: 0.76
    },
    baseMood: {
      manager: 46,
      employee: 38
    },
    dailyOffsets: {
      1: -6,
      2: -3,
      3: -7,
      4: -4,
      5: -2
    },
    weeklyTrend: -0.7,
    moodNoise: 7,
    causeWeights: [
      ['WORKLOAD', 0.30],
      ['CLARITY', 0.24],
      ['BALANCE', 0.18],
      ['MOTIVATION', 0.14],
      ['RECOGNITION', 0.09],
      ['RELATIONS', 0.05]
    ],
    feedbacks: [
      {
        email: 'manager2@local.test',
        offsetDays: 2,
        category: 'WORKLOAD',
        feedbackText:
          "L'équipe traite trop de sujets à la fois et les arbitrages arrivent tard. On perd du temps à relancer, interrompre et re-prioriser au fil de l'eau.",
        solutionText:
          "Limiter le nombre de chantiers simultanés, faire un arbitrage explicite deux fois par semaine et geler les changements non urgents."
      },
      {
        email: 'employee11@local.test',
        offsetDays: 3,
        category: 'WORK_LIFE_BALANCE',
        feedbackText:
          "Les fins de journée débordent régulièrement et plusieurs urgences tombent après 17h. La récupération devient difficile d'une semaine à l'autre.",
        solutionText:
          "Fixer une règle de non-escalade tardive, clarifier les vraies urgences et déplacer certaines réunions récurrentes plus tôt."
      },
      {
        email: 'employee12@local.test',
        offsetDays: 5,
        category: 'ORGANIZATION',
        feedbackText:
          "Les priorités changent sans qu'on comprenne toujours pourquoi. On repart souvent de zéro sur des tâches déjà bien avancées.",
        solutionText:
          "Centraliser les arbitrages dans un backlog unique avec date, motif du changement et validation managériale visible."
      },
      {
        email: 'employee14@local.test',
        offsetDays: 6,
        category: 'RECOGNITION',
        feedbackText:
          "Les efforts sont surtout visibles quand il y a un incident, rarement quand le travail est bien fait. Cela finit par user l'implication.",
        solutionText:
          "Instaurer un rituel simple de reconnaissance hebdomadaire avec exemples concrets d'efforts et impacts métier."
      },
      {
        email: 'employee15@local.test',
        offsetDays: 9,
        category: 'MOTIVATION',
        feedbackText:
          "Le rythme actuel donne l'impression de subir la semaine plutôt que d'avancer. L'équipe a du mal à voir l'utilité de certains arbitrages.",
        solutionText:
          "Partager les priorités avec leur impact attendu et fermer explicitement les sujets secondaires pour redonner du sens."
      },
      {
        email: 'employee17@local.test',
        offsetDays: 12,
        category: 'WORKLOAD',
        feedbackText:
          "On garde trop de sujets ouverts en parallèle et personne n'ose vraiment dire non. Cela augmente les erreurs et la fatigue mentale.",
        solutionText:
          "Réduire la simultanéité, afficher les limites de capacité de l'équipe et protéger un créneau quotidien sans interruption."
      },
      {
        email: 'employee18@local.test',
        offsetDays: 16,
        category: 'WORK_LIFE_BALANCE',
        feedbackText:
          "Quand une journée se passe mal, elle déborde sur la suivante car il n'y a pas de vrai temps de récupération. La fatigue devient cumulative.",
        solutionText:
          "Mettre en place des points de surcharge anticipés et sécuriser des créneaux sans réunions sur les jours les plus denses."
      },
      {
        email: 'employee20@local.test',
        offsetDays: 20,
        category: 'ORGANIZATION',
        feedbackText:
          "On reçoit des demandes de plusieurs interlocuteurs avec des attentes différentes. Cela crée du flou et beaucoup de rework.",
        solutionText:
          "Désigner un canal d'arbitrage unique et formaliser les décisions de priorité dans un support partagé."
      }
    ]
  }
];

const hashToUnit = (value) => {
  let hash = 0;
  const input = String(value);
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash / 0xffffffff;
};

const buildPlaceholders = (count, startIndex = 1) =>
  Array.from({ length: count }, (_, index) => `$${index + startIndex}`).join(', ');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pick = (array, key) => array[Math.floor(hashToUnit(key) * array.length) % array.length];

const pickWeighted = (weights, key, excluded = []) => {
  const filtered = weights.filter(([value]) => !excluded.includes(value));
  const total = filtered.reduce((sum, [, weight]) => sum + weight, 0);
  if (!total) return filtered[0] ? filtered[0][0] : weights[0][0];

  let cursor = hashToUnit(key) * total;
  for (const [value, weight] of filtered) {
    cursor -= weight;
    if (cursor <= 0) return value;
  }
  return filtered[filtered.length - 1][0];
};

const toDateIso = (date) => date.toISOString().split('T')[0];

const isWeekday = (date) => {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
};

const getRolePrefix = (role) => (role === 'manager' || role === 'admin' ? "Côté pilotage d'équipe, " : '');

const buildHealthyComment = ({ moodValue, causes, role, dateIso }) => {
  const primaryText = CAUSE_LABELS[causes[0]] || 'la journée';
  const secondaryText = causes[1] ? CAUSE_LABELS[causes[1]] || causes[1] : null;
  const prefix = getRolePrefix(role);

  if (moodValue >= 82) {
    return `${prefix}journée très solide le ${dateIso}, avec une bonne énergie collective. Le positif vient surtout de ${primaryText}${secondaryText ? ` et aussi de ${secondaryText}` : ''}.`;
  }

  return `${prefix}journée sereine le ${dateIso}, rythmée mais bien tenue. Les repères restent bons grâce à ${primaryText}${secondaryText ? ` et à ${secondaryText}` : ''}.`;
};

const buildStrugglingComment = ({ moodValue, causes, role, dateIso }) => {
  const primaryText = CAUSE_LABELS[causes[0]] || 'la journée';
  const secondaryText = causes[1] ? CAUSE_LABELS[causes[1]] || causes[1] : null;
  const prefix = getRolePrefix(role);

  if (moodValue <= 30) {
    return `${prefix}journée très tendue le ${dateIso}, avec une fatigue marquée. ${primaryText.charAt(0).toUpperCase()}${primaryText.slice(1)} domine nettement${secondaryText ? `, aggravée par ${secondaryText}` : ''}.`;
  }

  return `${prefix}journée compliquée le ${dateIso}, avec un rythme difficile à absorber. ${primaryText.charAt(0).toUpperCase()}${primaryText.slice(1)} pèse sur la concentration${secondaryText ? `, tout comme ${secondaryText}` : ''}.`;
};

const buildCheckinComment = ({ scenario, moodValue, causes, role, dateIso }) => {
  if (scenario.key === 'healthy') {
    return buildHealthyComment({ moodValue, causes, role, dateIso });
  }
  return buildStrugglingComment({ moodValue, causes, role, dateIso });
};

const buildOnboardingValues = ({ scenario, email }) => ({
  workStyle: pick(scenario.workStyles, `${email}:work_style`),
  motivationType: pick(scenario.motivationTypes, `${email}:motivation_type`),
  stressSource: pick(scenario.stressSources, `${email}:stress_source`)
});

const ensureOnboarding = async ({ user, scenario }) => {
  const onboarding = buildOnboardingValues({ scenario, email: user.email });
  const result = await db.run(
    `
      UPDATE users
      SET work_style = $1,
          motivation_type = $2,
          stress_source = $3,
          onboarding_completed = TRUE,
          updated_at = NOW()
      WHERE id = $4
        AND (
          onboarding_completed IS DISTINCT FROM TRUE
          OR work_style IS DISTINCT FROM $1
          OR motivation_type IS DISTINCT FROM $2
          OR stress_source IS DISTINCT FROM $3
        )
    `,
    [onboarding.workStyle, onboarding.motivationType, onboarding.stressSource, user.id]
  );

  return result.rowCount > 0;
};

const shouldCreateCheckin = ({ user, scenario, dateIso, isWorkingDay }) => {
  if (!isWorkingDay) return false;
  const roleRate = user.role === 'manager' ? scenario.presenceRate.manager : scenario.presenceRate.employee;
  return hashToUnit(`${user.email}:${dateIso}:presence`) <= roleRate;
};

const buildCheckinPayload = ({ user, scenario, date, dayOffset }) => {
  const weekday = date.getUTCDay();
  const baseMood = user.role === 'manager' ? scenario.baseMood.manager : scenario.baseMood.employee;
  const personalShift = Math.round((hashToUnit(`${user.email}:baseline`) - 0.5) * 8);
  const dailyOffset = scenario.dailyOffsets[weekday] || 0;
  const trendShift = Math.round(((DEMO_DAYS - dayOffset) / 7) * scenario.weeklyTrend);
  const noise = Math.round((hashToUnit(`${user.email}:${toDateIso(date)}:noise`) - 0.5) * scenario.moodNoise * 2);
  const moodValue = clamp(baseMood + personalShift + dailyOffset + trendShift + noise, 1, 100);

  const primaryCause = pickWeighted(scenario.causeWeights, `${user.email}:${toDateIso(date)}:cause1`);
  const secondaryCause = pickWeighted(scenario.causeWeights, `${user.email}:${toDateIso(date)}:cause2`, [primaryCause]);
  const causes = moodValue >= 78 && scenario.key === 'healthy'
    ? [primaryCause]
    : [primaryCause, secondaryCause];

  return {
    moodValue,
    causes,
    comment: buildCheckinComment({
      scenario,
      moodValue,
      causes,
      role: user.role,
      dateIso: toDateIso(date)
    }),
    timestamp: `${toDateIso(date)}T09:00:00.000Z`
  };
};

const ensureCheckin = async ({ user, scenario, date, dayOffset }) => {
  const dateIso = toDateIso(date);
  const shouldExist = shouldCreateCheckin({
    user,
    scenario,
    dateIso,
    isWorkingDay: isWeekday(date)
  });

  const existing = await db.get(
    `
      SELECT id
      FROM check_ins
      WHERE user_id = $1 AND DATE("timestamp" AT TIME ZONE 'UTC') = DATE($2)
      LIMIT 1
    `,
    [user.id, dateIso]
  );

  if (!shouldExist) {
    if (existing) {
      await db.run(
        `
          DELETE FROM check_ins
          WHERE user_id = $1 AND DATE("timestamp" AT TIME ZONE 'UTC') = DATE($2)
        `,
        [user.id, dateIso]
      );
    }
    return { created: false, updated: false, deleted: !!existing };
  }

  const payload = buildCheckinPayload({ user, scenario, date, dayOffset });
  if (existing) {
    await db.run(
      `
        UPDATE check_ins
        SET mood_value = $1,
            causes = $2,
            comment = $3,
            "timestamp" = $4
        WHERE id = $5
      `,
      [payload.moodValue, JSON.stringify(payload.causes), payload.comment, payload.timestamp, existing.id]
    );
    return { created: false, updated: true, deleted: false };
  }

  await db.run(
    `
      INSERT INTO check_ins (id, user_id, mood_value, causes, comment, "timestamp")
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [uuidv4(), user.id, payload.moodValue, JSON.stringify(payload.causes), payload.comment, payload.timestamp]
  );
  return { created: true, updated: false, deleted: false };
};

const ensureFeedback = async ({ userId, category, feedbackText, solutionText, isAnonymous, createdAt }) => {
  const existing = await db.get(
    `
      SELECT id
      FROM feedbacks
      WHERE user_id = $1 AND feedback_text = $2
      LIMIT 1
    `,
    [userId, feedbackText]
  );

  if (existing) {
    await db.run(
      `
        UPDATE feedbacks
        SET category = $1,
            solution_text = $2,
            is_anonymous = $3,
            created_at = $4,
            status = 'pending'
        WHERE id = $5
      `,
      [category, solutionText, isAnonymous, createdAt, existing.id]
    );
    return false;
  }

  await db.run(
    `
      INSERT INTO feedbacks (
        id, user_id, category, feedback_text, solution_text, status, is_anonymous, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
    `,
    [uuidv4(), userId, category, feedbackText, solutionText, isAnonymous, createdAt]
  );

  return true;
};

const cleanupLegacySeedFeedbacks = async () => {
  const result = await db.run(
    `
      DELETE FROM feedbacks
      WHERE feedback_text LIKE 'Seed feedback % for %@'
         OR solution_text LIKE 'Seed solution % for %@'
    `
  );
  return result.rowCount || 0;
};

const deleteOlderCheckins = async ({ userIds, startDate }) => {
  if (!userIds.length) return 0;
  const placeholders = buildPlaceholders(userIds.length);
  const result = await db.run(
    `
      DELETE FROM check_ins
      WHERE user_id IN (${placeholders})
        AND DATE("timestamp" AT TIME ZONE 'UTC') < $${userIds.length + 1}::date
    `,
    [...userIds, startDate]
  );
  return result.rowCount || 0;
};

const deleteOlderFeedbacks = async ({ userIds, startDate }) => {
  if (!userIds.length) return 0;
  const placeholders = buildPlaceholders(userIds.length);
  const result = await db.run(
    `
      DELETE FROM feedbacks
      WHERE user_id IN (${placeholders})
        AND DATE(created_at AT TIME ZONE 'UTC') < $${userIds.length + 1}::date
    `,
    [...userIds, startDate]
  );
  return result.rowCount || 0;
};

const syncFeedbackWindow = async ({ user, desiredFeedbacks, startDate }) => {
  const allowedTexts = desiredFeedbacks.map((feedback) => feedback.feedbackText);

  if (!allowedTexts.length) {
    await db.run(
      `
        DELETE FROM feedbacks
        WHERE user_id = $1
          AND DATE(created_at AT TIME ZONE 'UTC') >= $2::date
      `,
      [user.id, startDate]
    );
    return;
  }

  const placeholders = buildPlaceholders(allowedTexts.length, 3);
  await db.run(
    `
      DELETE FROM feedbacks
      WHERE user_id = $1
        AND DATE(created_at AT TIME ZONE 'UTC') >= $2::date
        AND feedback_text NOT IN (${placeholders})
    `,
    [user.id, startDate, ...allowedTexts]
  );
};

const ensureTeam = async ({ organizationId, name }) => {
  const existing = await db.get(
    'SELECT id, name, organization_id FROM teams WHERE organization_id = $1 AND name = $2 LIMIT 1',
    [organizationId, name]
  );
  if (existing) {
    return { team: existing, created: false };
  }

  const id = uuidv4();
  await db.run('INSERT INTO teams (id, organization_id, name) VALUES ($1, $2, $3)', [id, organizationId, name]);
  return { team: { id, organization_id: organizationId, name }, created: true };
};

const resetTeamMemberships = async ({ userIds }) => {
  if (!userIds.length) return;
  const placeholders = buildPlaceholders(userIds.length);
  await db.run(`DELETE FROM team_members WHERE user_id IN (${placeholders})`, userIds);
};

const ensureTeamMember = async ({ teamId, userId }) => {
  await db.run(
    `
      INSERT INTO team_members (id, team_id, user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (team_id, user_id) DO NOTHING
    `,
    [uuidv4(), teamId, userId]
  );
};

const buildUserDefinitions = () => {
  const definitions = [
    {
      email: DEFAULT_ADMIN_EMAIL,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'Local',
      scenarioKey: null
    },
    {
      email: 'manager1@local.test',
      role: 'manager',
      firstName: 'Manager1',
      lastName: 'Local',
      scenarioKey: 'healthy'
    },
    {
      email: 'manager2@local.test',
      role: 'manager',
      firstName: 'Manager2',
      lastName: 'Local',
      scenarioKey: 'struggling'
    }
  ];

  for (let i = 1; i <= 20; i++) {
    definitions.push({
      email: `employee${String(i).padStart(2, '0')}@local.test`,
      role: 'employee',
      firstName: `Employee${String(i).padStart(2, '0')}`,
      lastName: 'Local',
      scenarioKey: i <= 10 ? 'healthy' : 'struggling'
    });
  }

  return definitions;
};

const seedDevelopmentData = async () => {
  if (process.env.NODE_ENV !== 'development') {
    return { skipped: true, reason: 'non-development-environment' };
  }

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    let organizationId = await organizationRepository.getAnyOrganizationId();
    if (!organizationId) {
      organizationId = uuidv4();
      await organizationRepository.createIfNotExists({
        id: organizationId,
        name: DEFAULT_ORG_NAME
      });
    }

    const summary = {
      skipped: false,
      organizationId,
      credentials: {
        password: DEFAULT_PASSWORD
      },
      scenarios: {
        healthyTeam: {
          name: 'Equipe A',
          manager: 'manager1@local.test',
          employees: 'employee01@local.test -> employee10@local.test'
        },
        strugglingTeam: {
          name: 'Equipe B',
          manager: 'manager2@local.test',
          employees: 'employee11@local.test -> employee20@local.test'
        }
      },
      users: {
        created: 0
      },
      onboarding: {
        ensured: 0
      },
      teams: {
        created: 0
      },
      teamMembers: {
        ensured: 0
      },
      checkins: {
        created: 0,
        updated: 0,
        deleted: 0,
        trimmedOlderRows: 0
      },
      feedbacks: {
        created: 0,
        trimmedOlderRows: 0,
        cleanedLegacy: 0
      }
    };

    const userDefinitions = buildUserDefinitions();
    const usersByEmail = {};
    for (const definition of userDefinitions) {
      const result = await userRepository.createIfNotExists({
        email: definition.email,
        role: definition.role,
        organizationId,
        firstName: definition.firstName,
        lastName: definition.lastName,
        passwordHash
      });
      if (result.created) summary.users.created += 1;
      usersByEmail[definition.email] = {
        ...result.user,
        scenarioKey: definition.scenarioKey
      };
    }

    const seedUserIds = userDefinitions
      .filter((definition) => definition.role !== 'admin')
      .map((definition) => usersByEmail[definition.email].id);
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - (DEMO_DAYS - 1));
    const startDateIso = toDateIso(startDate);

    summary.feedbacks.cleanedLegacy = await cleanupLegacySeedFeedbacks();
    summary.checkins.trimmedOlderRows = await deleteOlderCheckins({ userIds: seedUserIds, startDate: startDateIso });
    summary.feedbacks.trimmedOlderRows = await deleteOlderFeedbacks({ userIds: seedUserIds, startDate: startDateIso });
    await resetTeamMemberships({ userIds: seedUserIds });

    const teamsByScenario = {};
    for (const scenario of TEAM_DEMOS) {
      const teamResult = await ensureTeam({ organizationId, name: scenario.name });
      if (teamResult.created) summary.teams.created += 1;
      teamsByScenario[scenario.key] = teamResult.team;
    }

    for (const definition of userDefinitions.filter((entry) => entry.scenarioKey)) {
      const user = usersByEmail[definition.email];
      const scenario = TEAM_DEMOS.find((item) => item.key === definition.scenarioKey);
      await ensureTeamMember({ teamId: teamsByScenario[scenario.key].id, userId: user.id });
      summary.teamMembers.ensured += 1;
    }

    for (const definition of userDefinitions.filter((entry) => entry.scenarioKey)) {
      const user = usersByEmail[definition.email];
      const scenario = TEAM_DEMOS.find((item) => item.key === definition.scenarioKey);
      const ensured = await ensureOnboarding({ user, scenario });
      if (ensured) summary.onboarding.ensured += 1;
    }

    for (const definition of userDefinitions.filter((entry) => entry.scenarioKey)) {
      const user = usersByEmail[definition.email];
      const scenario = TEAM_DEMOS.find((item) => item.key === definition.scenarioKey);

      for (let dayOffset = 0; dayOffset < DEMO_DAYS; dayOffset++) {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - dayOffset);
        const result = await ensureCheckin({ user, scenario, date, dayOffset });
        if (result.created) summary.checkins.created += 1;
        if (result.updated) summary.checkins.updated += 1;
        if (result.deleted) summary.checkins.deleted += 1;
      }
    }

    for (const scenario of TEAM_DEMOS) {
      const desiredByEmail = scenario.feedbacks.reduce((acc, feedback) => {
        if (!acc[feedback.email]) acc[feedback.email] = [];
        acc[feedback.email].push(feedback);
        return acc;
      }, {});

      const scenarioUsers = userDefinitions
        .filter((definition) => definition.scenarioKey === scenario.key)
        .map((definition) => usersByEmail[definition.email]);

      for (const user of scenarioUsers) {
        await syncFeedbackWindow({
          user,
          desiredFeedbacks: desiredByEmail[user.email] || [],
          startDate: startDateIso
        });
      }

      for (const feedback of scenario.feedbacks) {
        const user = usersByEmail[feedback.email];
        const createdAt = new Date();
        createdAt.setUTCDate(createdAt.getUTCDate() - feedback.offsetDays);
        const created = await ensureFeedback({
          userId: user.id,
          category: FEEDBACK_CATEGORIES.includes(feedback.category) ? feedback.category : 'ORGANIZATION',
          feedbackText: feedback.feedbackText,
          solutionText: feedback.solutionText,
          isAnonymous: user.role === 'employee',
          createdAt: createdAt.toISOString()
        });
        if (created) summary.feedbacks.created += 1;
      }
    }

    console.log(
      `Dev demo seed complete: users+${summary.users.created}, onboarding+${summary.onboarding.ensured}, teams+${summary.teams.created}, memberships+${summary.teamMembers.ensured}, checkins(created:${summary.checkins.created}, updated:${summary.checkins.updated}, deleted:${summary.checkins.deleted}, trimmed:${summary.checkins.trimmedOlderRows}), feedbacks(created:${summary.feedbacks.created}, trimmed:${summary.feedbacks.trimmedOlderRows}, cleanedLegacy:${summary.feedbacks.cleanedLegacy})`
    );

    return summary;
  } catch (err) {
    console.error('Dev seed failed:', err.message);
    return { skipped: false, failed: true };
  }
};

module.exports = {
  seedDevelopmentData
};
