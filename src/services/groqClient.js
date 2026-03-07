const { AppError } = require('../utils/errors');

const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_TIMEOUT_MS = 8000;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const formatScore = (value) => String(value).replace('.', ',');

const buildPrompt = ({ weekStart, weekEnd, metrics, insightContext }) => {
  const dailyTrendText = metrics.daily.length
    ? metrics.daily
      .map((entry) => `${entry.date}: ${entry.moodValue === null ? 'aucune donnée' : `${formatScore(entry.moodValue)}/10`} (${entry.label})`)
      .join(' | ')
    : 'aucune donnée';

  const topLevers = insightContext.topCauseLabels.length
    ? insightContext.topCauseLabels.join(', ')
    : 'aucun levier dominant';
  const feedbackSignals = Object.keys(insightContext.feedbackCategoryLabels).length
    ? JSON.stringify(insightContext.feedbackCategoryLabels)
    : 'aucun feedback cette semaine';
  const lowestDayText = insightContext.lowestDay
    ? `${insightContext.lowestDay.date} à ${formatScore(insightContext.lowestDay.moodValue)}/10`
    : 'aucun point bas identifié';
  const highestDayText = insightContext.highestDay
    ? `${insightContext.highestDay.date} à ${formatScore(insightContext.highestDay.moodValue)}/10`
    : 'aucun point haut identifié';

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
    `Semaine: ${weekStart} -> ${weekEnd}`,
    `Taille de l'équipe: ${insightContext.teamSize} membre(s)`,
    `Niveau d'ambiance: ${insightContext.moodBand}`,
    `Humeur moyenne: ${metrics.averageMood === null ? 'aucune donnée' : `${formatScore(metrics.averageMood)}/10`}`,
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

const generateTeamWeeklyInsight = async ({ weekStart, weekEnd, metrics, insightContext }) => {
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
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new AppError(`Groq request failed with status ${response.status}`, 502, 'AI_GENERATION_FAILED');
    }

    const payload = await response.json();
    const summaryText = payload &&
      payload.choices &&
      payload.choices[0] &&
      payload.choices[0].message &&
      typeof payload.choices[0].message.content === 'string'
      ? payload.choices[0].message.content.trim()
      : '';

    if (!summaryText) {
      throw new AppError('Groq returned an empty response', 502, 'AI_GENERATION_FAILED');
    }

    return summaryText;
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

module.exports = {
  generateTeamWeeklyInsight
};
