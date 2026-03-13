const { AppError } = require('../utils/errors');

const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_TIMEOUT_MS = 8000;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const formatScore = (value) => String(value).replace('.', ',');
const formatDisplayDate = (value) => {
  if (typeof value !== 'string') return value;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
};

const buildPrompt = ({ weekStart, weekEnd, metrics, insightContext }) => {
  const dailyTrendText = metrics.daily.length
    ? metrics.daily
      .map((entry) => {
        const moodText = entry.moodValue === null ? 'aucune donnée' : `${formatScore(entry.moodValue)}/10`;
        return `${formatDisplayDate(entry.date)}: ${moodText} (${entry.label})`;
      })
      .join(' | ')
    : 'aucune donnée';

  const topLevers = insightContext.topCauseLabels.length
    ? insightContext.topCauseLabels.join(', ')
    : 'aucun levier dominant';
  const feedbackSignals = Object.keys(insightContext.feedbackCategoryLabels).length
    ? JSON.stringify(insightContext.feedbackCategoryLabels)
    : 'aucun feedback cette semaine';
  const lowestDayText = insightContext.lowestDay
    ? `${formatDisplayDate(insightContext.lowestDay.date)} à ${formatScore(insightContext.lowestDay.moodValue)}/10`
    : 'aucun point bas identifié';
  const highestDayText = insightContext.highestDay
    ? `${formatDisplayDate(insightContext.highestDay.date)} à ${formatScore(insightContext.highestDay.moodValue)}/10`
    : 'aucun point haut identifié';
  const averageMoodText = metrics.averageMood === null ? 'aucune donnée' : `${formatScore(metrics.averageMood)}/10`;

  return [
    'Tu es un analyste RH qui rédige pour un produit SaaS RH visible par des salariés et des managers.',
    'Rédige une synthèse hebdomadaire d’équipe en français naturel, professionnel, concise et factuelle.',
    'Réponds en exactement 3 phrases courtes.',
    "Commence directement par le constat principal. N'écris pas d'introduction du type 'La synthèse indique' ou 'Cette semaine'.",
    "N'utilise jamais de codes techniques ou d'anglais comme CLARITY, BALANCE, WORKLOAD. Utilise uniquement les libellés métier français fournis.",
    "Structure impérative: phrase 1 = niveau global d'ambiance + humeur moyenne + participation. Phrase 2 = variation dans la semaine avec point bas ou stabilité. Phrase 3 = lecture des principaux leviers ou vigilance légère.",
    "S'il n'y a pas de variation marquée, parle explicitement de stabilité ou de faible variation.",
    "S'il n'y a pas de feedback, n'invente pas de retours remontés.",
    "Privilégie une lecture utile produit: ambiance positive, correcte, fragile ou très dégradée; stabilité, léger mieux, tassement, vigilance modérée, pas de signal d'alerte fort.",
    "N'invente aucun fait absent du contexte. Ne parle pas de hausse de participation si le contexte ne le dit pas.",
    '',
    `Semaine: ${formatDisplayDate(weekStart)} -> ${formatDisplayDate(weekEnd)}`,
    `Taille de l'équipe: ${insightContext.teamSize} membre(s)`,
    `Niveau d'ambiance: ${insightContext.moodBand}`,
    `Humeur moyenne: ${averageMoodText}`,
    `Participation: ${metrics.participation} membre(s) actifs sur ${insightContext.teamSize}, soit ${metrics.participationRate}%`,
    `Tendance globale: ${insightContext.trend}`,
    `Intensité de variation: ${insightContext.trendStrength}`,
    `Point bas: ${lowestDayText}`,
    `Point haut: ${highestDayText}`,
    `Aide à l'interprétation de la tendance: ${insightContext.trendSummary}`,
    `Leviers dominants: ${topLevers}`,
    `Signaux feedback agrégés: ${feedbackSignals}`,
    `Détail quotidien: ${dailyTrendText}`
  ].join('\n');
};

const stripCodeFences = (value) =>
  value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const callGroq = async ({ payload }) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AppError('Groq API key not configured', 502, 'AI_GENERATION_FAILED');
  }

  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const timeoutMs = Number.parseInt(process.env.GROQ_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        ...payload
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new AppError(`Groq request failed with status ${response.status}`, 502, 'AI_GENERATION_FAILED');
    }

    const groqPayload = await response.json();
    const content = groqPayload &&
      groqPayload.choices &&
      groqPayload.choices[0] &&
      groqPayload.choices[0].message &&
      typeof groqPayload.choices[0].message.content === 'string'
      ? groqPayload.choices[0].message.content.trim()
      : '';

    if (!content) {
      throw new AppError('Groq returned an empty response', 502, 'AI_GENERATION_FAILED');
    }

    return content;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    if (err && err.name === 'AbortError') {
      throw new AppError('Groq request timed out', 502, 'AI_GENERATION_FAILED');
    }
    throw new AppError('Groq request failed', 502, 'AI_GENERATION_FAILED');
  } finally {
    clearTimeout(timeoutId);
  }
};

const generateTeamWeeklyInsight = async ({ weekStart, weekEnd, metrics, insightContext }) => {
  return callGroq({
    payload: {
      messages: [
        {
          role: 'system',
          content: 'Tu fournis des synthèses RH courtes, exactes, naturelles et prudentes.'
        },
        {
          role: 'user',
          content: buildPrompt({ weekStart, weekEnd, metrics, insightContext })
        }
      ]
    }
  });
};

const buildUserWeeklyInsightPrompt = ({ weekStart, weekEnd, metrics, insightContext }) => {
  const dailyTrendText = metrics.daily.length
    ? metrics.daily
      .map((entry) => {
        const moodText = entry.moodValue === null ? 'aucune donnée' : `${formatScore(entry.moodValue)}/10`;
        return `${formatDisplayDate(entry.date)}: ${moodText} (${entry.label})`;
      })
      .join(' | ')
    : 'aucune donnée';

  const topLevers = insightContext.topCauseLabels.length
    ? insightContext.topCauseLabels.join(', ')
    : 'aucun levier dominant';
  const feedbackSignals = Object.keys(insightContext.feedbackCategoryLabels).length
    ? JSON.stringify(insightContext.feedbackCategoryLabels)
    : 'aucun feedback cette semaine';
  const lowestDayText = insightContext.lowestDay
    ? `${formatDisplayDate(insightContext.lowestDay.date)} à ${formatScore(insightContext.lowestDay.moodValue)}/10`
    : 'aucun point bas identifié';
  const highestDayText = insightContext.highestDay
    ? `${formatDisplayDate(insightContext.highestDay.date)} à ${formatScore(insightContext.highestDay.moodValue)}/10`
    : 'aucun point haut identifié';
  const averageMoodText = metrics.averageMood === null ? 'aucune donnée' : `${formatScore(metrics.averageMood)}/10`;

  return [
    'Tu rédiges un bilan hebdomadaire personnel pour un salarié dans un produit SaaS RH.',
    'Rédige en français naturel, factuel, direct et rassurant quand les données le permettent.',
    'Réponds en exactement 3 phrases courtes.',
    "Parle à la 2e personne du singulier et commence directement par 'Ta semaine' ou un constat équivalent naturel.",
    "N'utilise jamais de codes techniques ou d'anglais comme CLARITY, BALANCE, WORKLOAD. Utilise uniquement les libellés métier français fournis.",
    "Structure impérative: phrase 1 = dynamique globale + humeur moyenne + participation. Phrase 2 = évolution dans la semaine avec point bas ou stabilité. Phrase 3 = conclusion globale sur l'équilibre, les ressentis dominants ou une vigilance modérée.",
    "S'il n'y a pas de variation marquée, parle explicitement de stabilité ou de faible variation.",
    "S'il n'y a pas de feedback, n'invente pas de retours remontés.",
    "N'invente aucun fait absent du contexte. Ne donne aucun conseil, ne propose aucune action, ne parle pas d'équipe ou de manager.",
    '',
    `Semaine: ${formatDisplayDate(weekStart)} -> ${formatDisplayDate(weekEnd)}`,
    `Niveau d'ambiance: ${insightContext.moodBand}`,
    `Humeur moyenne: ${averageMoodText}`,
    `Participation: ${metrics.participation} check-in(s) sur 5, soit ${metrics.participationRate}%`,
    `Tendance globale: ${insightContext.trend}`,
    `Intensité de variation: ${insightContext.trendStrength}`,
    `Point bas: ${lowestDayText}`,
    `Point haut: ${highestDayText}`,
    `Aide à l'interprétation de la tendance: ${insightContext.trendSummary}`,
    `Leviers dominants: ${topLevers}`,
    `Signaux feedback agrégés: ${feedbackSignals}`,
    `Détail quotidien: ${dailyTrendText}`
  ].join('\n');
};

const generateUserWeeklyInsight = async ({ weekStart, weekEnd, metrics, insightContext }) => {
  return callGroq({
    payload: {
      messages: [
        {
          role: 'system',
          content: 'Tu fournis des bilans personnels RH courts, exacts, naturels et prudents.'
        },
        {
          role: 'user',
          content: buildUserWeeklyInsightPrompt({ weekStart, weekEnd, metrics, insightContext })
        }
      ]
    }
  });
};

const buildAnalysisReportPrompt = ({ context, actionCatalog, activityCatalog }) => {
  return [
    'Tu es un analyste RH senior qui produit un rapport d’aide à la décision pour un manager.',
    "Réponds uniquement avec un JSON valide, sans markdown, sans commentaire, sans texte avant ou après.",
    "N'invente aucun fait absent du contexte. N'utilise que les actions et activités présentes dans les catalogues fournis.",
    'Respecte strictement les volumes: 3 strengths, 5 weaknesses, 4 recommendedActions, 3 teamActivities.',
    'Chaque weakness doit avoir un poids entier entre 0 et 100. Les weights doivent refléter une hiérarchie crédible.',
    'Les strengths et weaknesses doivent être formulés en français naturel, orientés management, sans jargon technique.',
    "Ajoute aussi deux champs top-level: strengthsSummary et weaknessesSummary.",
    "strengthsSummary doit être une seule phrase courte qui résume l'ensemble des points forts et indique comment capitaliser dessus.",
    "weaknessesSummary doit être une seule phrase courte qui résume l'ensemble des points faibles et formule le risque principal ou la priorité d'action.",
    "Un même thème ne peut pas apparaître à la fois en point fort et en point faible. Si un facteur est un irritant majeur, n'en fais pas un point fort.",
    "Privilégie pour les points forts des signaux observables et robustes: participation, stabilité, climat général, absence d'alerte forte, cohésion si elle n'est pas déjà un irritant.",
    "Le champ analysisMode indique le niveau attendu du rapport: healthy = posture de consolidation, mixed = posture équilibrée, critical = posture de redressement. Calibre le ton et les actions en conséquence.",
    "Varie le style des descriptions de faiblesses: évite de répéter la même tournure pour chaque item.",
    "Les résumés d'actions doivent être concrets, manager-ready, et expliquer en une phrase le bénéfice attendu.",
    'Pour recommendedActions et teamActivities, réutilise les ids du catalogue exactement.',
    '',
    `Contexte d'analyse: ${JSON.stringify(context)}`,
    `Catalogue actions: ${JSON.stringify(actionCatalog)}`,
    `Catalogue activités: ${JSON.stringify(activityCatalog)}`,
    '',
    'Schéma JSON attendu:',
    JSON.stringify({
      strengthsSummary: 'string',
      weaknessesSummary: 'string',
      strengths: [
        { rank: 1, title: 'string', weight: 35, description: 'string' }
      ],
      weaknesses: [
        { rank: 1, title: 'string', weight: 30, description: 'string' }
      ],
      recommendedActions: [
        {
          id: 'reduce-workload',
          summary: 'string'
        }
      ],
      teamActivities: [
        {
          id: 'solution-retro',
          summary: 'string'
        }
      ]
    })
  ].join('\n');
};

const generateTeamWeeklyAnalysisReport = async ({ context, actionCatalog, activityCatalog }) => {
  const raw = await callGroq({
    payload: {
      messages: [
        {
          role: 'system',
          content: "Tu fournis uniquement du JSON valide pour un rapport d'analyse RH structuré."
        },
        {
          role: 'user',
          content: buildAnalysisReportPrompt({ context, actionCatalog, activityCatalog })
        }
      ]
    }
  });

  try {
    return JSON.parse(stripCodeFences(raw));
  } catch {
    throw new AppError('Groq returned invalid JSON', 502, 'AI_GENERATION_FAILED');
  }
};

module.exports = {
  generateTeamWeeklyInsight,
  generateUserWeeklyInsight,
  generateTeamWeeklyAnalysisReport
};
