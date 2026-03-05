const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./query');
const organizationRepository = require('../repositories/organizationRepository');
const userRepository = require('../repositories/userRepository');

const DEFAULT_ORG_NAME = 'Default Organization';
const DEFAULT_ADMIN_EMAIL = 'admin@local.test';
const DEFAULT_PASSWORD = 'adminadmin';
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
const WORK_STYLES = ['Collaboratif', 'Autonome', 'Structuré', 'Flexible'];
const MOTIVATION_TYPES = ['Reconnaissance', 'Apprentissage', 'Impact', 'Équilibre'];
const STRESS_SOURCES = ['Charge de travail', 'Relations', 'Incertitude', 'Délais'];
const CAUSE_LABELS = {
  WORKLOAD: 'la charge de travail',
  RELATIONS: "la qualité des échanges",
  MOTIVATION: 'la motivation',
  CLARITY: 'la clarté des priorités',
  RECOGNITION: 'la reconnaissance',
  BALANCE: "l'équilibre pro/perso"
};
const FEEDBACK_SCENARIOS = [
  {
    category: 'WORKLOAD',
    feedbackText:
      "En fin de mois, les demandes opérationnelles et les points transverses se concentrent sur les mêmes journées. L'équipe manque de temps pour finaliser correctement.",
    solutionText:
      "Planifier un créneau hebdomadaire de priorisation avec blocage des tâches non critiques et définir une capacité maximale par sprint."
  },
  {
    category: 'RELATIONS',
    feedbackText:
      "Les échanges entre les deux équipes sont parfois trop tardifs et on découvre certains blocages au dernier moment, ce qui crée de la tension.",
    solutionText:
      'Mettre en place un point inter-équipes de 20 minutes deux fois par semaine avec un tableau partagé des dépendances.'
  },
  {
    category: 'MOTIVATION',
    feedbackText:
      "Plusieurs collaborateurs ont le sentiment que leurs efforts ne sont pas visibles lorsque les objectifs sont atteints collectivement.",
    solutionText:
      "Instaurer un rituel de valorisation en fin de semaine avec exemples concrets de contributions individuelles et impacts métier."
  },
  {
    category: 'ORGANIZATION',
    feedbackText:
      "Le suivi des priorités change souvent sans trace claire, ce qui provoque des reworks et de l'incertitude pour l'équipe.",
    solutionText:
      "Formaliser les changements de priorité dans un backlog unique avec date, motif et validation du manager."
  },
  {
    category: 'RECOGNITION',
    feedbackText:
      "Les retours positifs sont principalement informels. Les équipes demandent plus de reconnaissance structurée sur les progrès réalisés.",
    solutionText:
      "Ajouter un point mensuel de feedback managérial et intégrer un canal dédié aux réussites avec critères de reconnaissance."
  },
  {
    category: 'WORK_LIFE_BALANCE',
    feedbackText:
      "Certaines réunions dépassent régulièrement en fin de journée, ce qui complique l'équilibre personnel de plusieurs salariés.",
    solutionText:
      'Limiter les réunions à 45 minutes, bloquer un créneau sans réunion après 17h et suivre un indicateur hebdomadaire.'
  },
  {
    category: 'FACILITIES',
    feedbackText:
      "Les espaces de concentration sont souvent occupés et le bruit ambiant rend les tâches d'analyse plus difficiles.",
    solutionText:
      "Réserver des plages de travail silencieux, améliorer l'isolation de deux salles et équiper l'équipe de casques adaptés."
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

const pick = (array, key) => array[Math.floor(hashToUnit(key) * array.length) % array.length];

const parseCauses = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const buildCheckinComment = ({ moodValue, causes, dateIso, role }) => {
  const primaryCause = causes[0] || 'MOTIVATION';
  const secondaryCause = causes[1] || null;
  const primaryText = CAUSE_LABELS[primaryCause] || 'la journée';
  const secondaryText = secondaryCause ? CAUSE_LABELS[secondaryCause] || secondaryCause : null;
  const managerPrefix = role === 'manager' || role === 'admin' ? "Côté pilotage d'équipe, " : '';

  if (moodValue >= 78) {
    return `${managerPrefix}journée fluide le ${dateIso}, bon niveau d'énergie et avancée nette. ${
      secondaryText
        ? `Le positif vient surtout de ${primaryText} et aussi de ${secondaryText}.`
        : `Le positif vient surtout de ${primaryText}.`
    }`;
  }
  if (moodValue >= 55) {
    return `${managerPrefix}journée correcte le ${dateIso}, avec un rythme stable mais perfectible. ${
      secondaryText
        ? `Les principaux facteurs observés sont ${primaryText} et ${secondaryText}.`
        : `Le facteur principal observé est ${primaryText}.`
    }`;
  }
  if (moodValue >= 35) {
    return `${managerPrefix}journée tendue le ${dateIso}: ${primaryText} pèse sur la concentration. ${
      secondaryText
        ? `Il faudrait aussi agir sur ${secondaryText} pour retrouver un meilleur équilibre.`
        : 'Un ajustement de priorités aiderait à réduire la pression.'
    }`;
  }
  return `${managerPrefix}journée difficile le ${dateIso}, niveau de charge élevé et fatigue marquée. ${
    secondaryText
      ? `Les causes dominantes sont ${primaryText} et ${secondaryText}; un soutien rapide est nécessaire.`
      : `La cause dominante est ${primaryText}; un soutien rapide est nécessaire.`
  }`;
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

const ensureOnboarding = async ({ user }) => {
  const workStyle = pick(WORK_STYLES, `${user.email}:work_style`);
  const motivationType = pick(MOTIVATION_TYPES, `${user.email}:motivation_type`);
  const stressSource = pick(STRESS_SOURCES, `${user.email}:stress_source`);

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
    [workStyle, motivationType, stressSource, user.id]
  );

  return result.rowCount > 0;
};

const ensureCheckin = async ({ user, dateIso }) => {
  const existing = await db.get(
    `
      SELECT id, mood_value, causes, comment FROM check_ins
      WHERE user_id = $1 AND DATE("timestamp" AT TIME ZONE 'UTC') = DATE($2)
      LIMIT 1
    `,
    [user.id, dateIso]
  );

  const baseMood = 45 + Math.round(hashToUnit(`${user.id}:base`) * 35);
  const daySwing = Math.round((hashToUnit(`${user.id}:${dateIso}:swing`) - 0.5) * 30);
  const moodValue = Math.max(1, Math.min(100, baseMood + daySwing));
  const primaryCause = pick(VALID_CAUSES, `${user.id}:${dateIso}:cause1`);
  const secondaryCause = pick(VALID_CAUSES, `${user.id}:${dateIso}:cause2`);
  const causes = primaryCause === secondaryCause ? [primaryCause] : [primaryCause, secondaryCause];
  const comment = buildCheckinComment({ moodValue, causes, dateIso, role: user.role });
  const timestamp = `${dateIso}T09:00:00.000Z`;

  if (existing) {
    const needsRichComment =
      !existing.comment ||
      !existing.comment.trim() ||
      existing.comment.startsWith('Seed check-in');

    if (needsRichComment) {
      const existingCauses = parseCauses(existing.causes);
      const generatedComment = buildCheckinComment({
        moodValue: existing.mood_value,
        causes: existingCauses.length ? existingCauses : causes,
        dateIso,
        role: user.role
      });
      await db.run('UPDATE check_ins SET comment = $1 WHERE id = $2', [generatedComment, existing.id]);
      return { created: false, commentFilled: true };
    }
    return { created: false, commentFilled: false };
  }

  await db.run(
    `
      INSERT INTO check_ins (id, user_id, mood_value, causes, comment, "timestamp")
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [uuidv4(), user.id, moodValue, JSON.stringify(causes), comment, timestamp]
  );
  return { created: true, commentFilled: false };
};

const ensureFeedback = async ({ userId, category, feedbackText, solutionText, isAnonymous, createdAt }) => {
  const existing = await db.get(
    `
      SELECT id FROM feedbacks
      WHERE user_id = $1 AND feedback_text = $2
      LIMIT 1
    `,
    [userId, feedbackText]
  );
  if (existing) return false;

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
        commentsFilled: 0
      },
      feedbacks: {
        created: 0,
        cleanedLegacy: 0
      }
    };

    summary.feedbacks.cleanedLegacy = await cleanupLegacySeedFeedbacks();

    const adminResult = await userRepository.createIfNotExists({
      email: DEFAULT_ADMIN_EMAIL,
      role: 'admin',
      organizationId,
      firstName: 'Admin',
      lastName: 'Local',
      passwordHash
    });
    if (adminResult.created) summary.users.created += 1;

    const managers = [];
    for (let i = 1; i <= 2; i++) {
      const managerResult = await userRepository.createIfNotExists({
        email: `manager${i}@local.test`,
        role: 'manager',
        organizationId,
        firstName: `Manager${i}`,
        lastName: 'Local',
        passwordHash
      });
      if (managerResult.created) summary.users.created += 1;
      managers.push(managerResult.user);
    }

    const teams = [];
    const teamNames = ['Equipe A', 'Equipe B'];
    for (const teamName of teamNames) {
      const teamResult = await ensureTeam({ organizationId, name: teamName });
      if (teamResult.created) summary.teams.created += 1;
      teams.push(teamResult.team);
    }

    const employeesByTeam = [[], []];
    for (let i = 1; i <= 20; i++) {
      const teamIndex = i <= 10 ? 0 : 1;
      const employeeResult = await userRepository.createIfNotExists({
        email: `employee${String(i).padStart(2, '0')}@local.test`,
        role: 'employee',
        organizationId,
        firstName: `Employee${String(i).padStart(2, '0')}`,
        lastName: 'Local',
        passwordHash
      });
      if (employeeResult.created) summary.users.created += 1;
      employeesByTeam[teamIndex].push(employeeResult.user);
    }

    for (let i = 0; i < teams.length; i++) {
      await ensureTeamMember({ teamId: teams[i].id, userId: managers[i].id });
      summary.teamMembers.ensured += 1;
      for (const employee of employeesByTeam[i]) {
        await ensureTeamMember({ teamId: teams[i].id, userId: employee.id });
        summary.teamMembers.ensured += 1;
      }
    }

    const allSeedUsers = [adminResult.user, ...managers, ...employeesByTeam[0], ...employeesByTeam[1]];
    for (const user of allSeedUsers) {
      const ensured = await ensureOnboarding({ user });
      if (ensured) summary.onboarding.ensured += 1;
    }

    const days = 90;
    for (const user of [...managers, ...employeesByTeam[0], ...employeesByTeam[1]]) {
      const completionRate = 0.7 + hashToUnit(`${user.email}:completion`) * 0.15;
      for (let dayOffset = 0; dayOffset < days; dayOffset++) {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - dayOffset);
        const dateIso = date.toISOString().split('T')[0];
        if (hashToUnit(`${user.email}:${dateIso}:presence`) <= completionRate) {
          const result = await ensureCheckin({ user, dateIso });
          if (result.created) summary.checkins.created += 1;
          if (result.commentFilled) summary.checkins.commentsFilled += 1;
        }
      }
    }

    const feedbackUsers = [
      managers[0],
      managers[1],
      ...employeesByTeam[0].slice(0, 4),
      ...employeesByTeam[1].slice(0, 4)
    ];
    for (let i = 0; i < feedbackUsers.length; i++) {
      const user = feedbackUsers[i];
      const scenario = FEEDBACK_SCENARIOS[i % FEEDBACK_SCENARIOS.length];
      const createdAt = new Date();
      createdAt.setUTCDate(createdAt.getUTCDate() - (i + 3));
      const created = await ensureFeedback({
        userId: user.id,
        category: scenario.category,
        feedbackText: scenario.feedbackText,
        solutionText: scenario.solutionText,
        isAnonymous: user.role === 'employee',
        createdAt: createdAt.toISOString()
      });
      if (created) summary.feedbacks.created += 1;
    }

    console.log(
      `Dev seed complete: users+${summary.users.created}, onboarding+${summary.onboarding.ensured}, teams+${summary.teams.created}, checkins+${summary.checkins.created}, comments+${summary.checkins.commentsFilled}, feedbacks+${summary.feedbacks.created}, feedbacksCleaned+${summary.feedbacks.cleanedLegacy}`
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
