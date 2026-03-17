const test = require('node:test');
const assert = require('node:assert');

process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'test-groq-key';

const groqClient = require('../src/services/groqClient');

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

const createFetchMock = () => {
  let requestBody = null;

  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);

    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: 'Synthèse générée'
              }
            }
          ]
        };
      }
    };
  };

  return () => requestBody;
};

test('generateTeamWeeklyInsight sends french-formatted dates in the Groq prompt', async () => {
  const getRequestBody = createFetchMock();

  await groqClient.generateTeamWeeklyInsight({
    weekStart: '2026-02-16',
    weekEnd: '2026-02-20',
    metrics: {
      averageMood: 7.9,
      participation: 5,
      participationRate: 100,
      daily: [
        { date: '2026-02-16', moodValue: 7.6, label: 'Jour correct' },
        { date: '2026-02-20', moodValue: 8.2, label: 'Jour excellent' }
      ]
    },
    insightContext: {
      teamSize: 5,
      moodBand: 'positive',
      trend: 'hausse',
      trendStrength: 'faible',
      trendSummary: 'Légère amélioration en fin de semaine.',
      topCauseLabels: ['reconnaissance', 'motivation'],
      feedbackCategoryLabels: {
        organisation: 1
      },
      lowestDay: {
        date: '2026-02-16',
        moodValue: 7.6
      },
      highestDay: {
        date: '2026-02-20',
        moodValue: 8.2
      }
    }
  });

  const requestBody = getRequestBody();
  const prompt = requestBody.messages[1].content;

  assert.match(prompt, /Semaine: 16-02-2026 -> 20-02-2026/);
  assert.match(prompt, /Point bas: 16-02-2026 à 7,6\/10/);
  assert.match(prompt, /Point haut: 20-02-2026 à 8,2\/10/);
  assert.match(prompt, /Détail quotidien: 16-02-2026: 7,6\/10 \(Jour correct\) \| 20-02-2026: 8,2\/10 \(Jour excellent\)/);
  assert.ok(!prompt.includes('2026-02-16:'));
});

test('generateUserWeeklyInsight sends french-formatted dates in the Groq prompt', async () => {
  const getRequestBody = createFetchMock();

  await groqClient.generateUserWeeklyInsight({
    weekStart: '2026-02-16',
    weekEnd: '2026-02-20',
    metrics: {
      averageMood: 8,
      participation: 4,
      participationRate: 80,
      daily: [
        { date: '2026-02-16', moodValue: 8, label: 'Jour excellent' },
        { date: '2026-02-18', moodValue: null, label: 'Aucun check-in' },
        { date: '2026-02-20', moodValue: 7.5, label: 'Jour correct' }
      ]
    },
    insightContext: {
      moodBand: 'positive',
      trend: 'stable',
      trendStrength: 'modérée',
      trendSummary: 'Semaine globalement stable.',
      topCauseLabels: ['charge de travail'],
      feedbackCategoryLabels: {},
      lowestDay: {
        date: '2026-02-20',
        moodValue: 7.5
      },
      highestDay: {
        date: '2026-02-16',
        moodValue: 8
      }
    }
  });

  const requestBody = getRequestBody();
  const prompt = requestBody.messages[1].content;

  assert.match(prompt, /Semaine: 16-02-2026 -> 20-02-2026/);
  assert.match(prompt, /Point bas: 20-02-2026 à 7,5\/10/);
  assert.match(prompt, /Point haut: 16-02-2026 à 8\/10/);
  assert.match(prompt, /Détail quotidien: 16-02-2026: 8\/10 \(Jour excellent\) \| 18-02-2026: aucune donnée \(Aucun check-in\) \| 20-02-2026: 7,5\/10 \(Jour correct\)/);
  assert.ok(!prompt.includes('2026-02-20:'));
});
