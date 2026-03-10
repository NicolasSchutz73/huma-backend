const test = require('node:test');
const assert = require('node:assert');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/huma_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const feedbackService = require('../src/services/feedbackService');
const feedbackRepository = require('../src/repositories/feedbackRepository');

const originalFeedbackRepository = {
  getById: feedbackRepository.getById,
  listAll: feedbackRepository.listAll,
  listByUserId: feedbackRepository.listByUserId,
  updateStatus: feedbackRepository.updateStatus
};

test.afterEach(() => {
  feedbackRepository.getById = originalFeedbackRepository.getById;
  feedbackRepository.listAll = originalFeedbackRepository.listAll;
  feedbackRepository.listByUserId = originalFeedbackRepository.listByUserId;
  feedbackRepository.updateStatus = originalFeedbackRepository.updateStatus;
});

test('listPublicFeedbacks returns all feedbacks without author data', async () => {
  feedbackRepository.listAll = async () => ([
    {
      id: 'feedback-1',
      category: 'WORKLOAD',
      date: '2026-03-09',
      status: 'pending',
      feedback_text: 'Charge de travail trop forte',
      solution_text: 'Prioriser les urgences',
      is_anonymous: false,
      user_id: 'user-1'
    }
  ]);

  const result = await feedbackService.listPublicFeedbacks();

  assert.deepStrictEqual(result, [
    {
      id: 'feedback-1',
      category: 'WORKLOAD',
      date: '2026-03-09',
      status: 'pending',
      feedbackText: 'Charge de travail trop forte',
      solutionText: 'Prioriser les urgences',
      isAnonymous: false
    }
  ]);
  assert.strictEqual(Object.hasOwn(result[0], 'userId'), false);
  assert.strictEqual(Object.hasOwn(result[0], 'user_id'), false);
});

test('getFeedbacks keeps user-scoped history format on /feedbacks/mine', async () => {
  feedbackRepository.listByUserId = async (userId) => {
    assert.strictEqual(userId, 'user-1');
    return [
      {
        id: 'feedback-2',
        category: 'MOTIVATION',
        date: '2026-03-08',
        status: 'vu',
        feedback_text: 'Texte un peu plus long que trente caractères',
        is_anonymous: true
      }
    ];
  };

  const result = await feedbackService.getFeedbacks({ userId: 'user-1' });

  assert.deepStrictEqual(result, [
    {
      id: 'feedback-2',
      category: 'MOTIVATION',
      date: '2026-03-08',
      status: 'vu',
      preview: 'Texte un peu plus long que tre...',
      isAnonymous: true
    }
  ]);
});

test('updateFeedbackStatus rejects employee role', async () => {
  await assert.rejects(
    feedbackService.updateFeedbackStatus({
      feedbackId: 'feedback-1',
      status: 'vu',
      userRole: 'employee'
    }),
    (err) => err.status === 403 && err.code === 'FORBIDDEN'
  );
});

test('updateFeedbackStatus rejects missing feedback', async () => {
  feedbackRepository.getById = async () => null;

  await assert.rejects(
    feedbackService.updateFeedbackStatus({
      feedbackId: 'missing-feedback',
      status: 'vu',
      userRole: 'manager'
    }),
    (err) => err.status === 404 && err.code === 'NOT_FOUND'
  );
});

test('updateFeedbackStatus updates feedback status for manager', async () => {
  feedbackRepository.getById = async (feedbackId) => {
    assert.strictEqual(feedbackId, 'feedback-3');
    return {
      id: 'feedback-3',
      category: 'RELATIONS',
      date: '2026-03-10',
      status: 'pending',
      feedback_text: 'Besoin de plus de communication',
      solution_text: 'Rituel hebdomadaire',
      is_anonymous: true
    };
  };
  feedbackRepository.updateStatus = async ({ feedbackId, status }) => {
    assert.strictEqual(feedbackId, 'feedback-3');
    assert.strictEqual(status, 'en_cours');
  };

  const result = await feedbackService.updateFeedbackStatus({
    feedbackId: 'feedback-3',
    status: 'en_cours',
    userRole: 'manager'
  });

  assert.deepStrictEqual(result, {
    message: 'Statut du feedback mis à jour',
    feedback: {
      id: 'feedback-3',
      category: 'RELATIONS',
      date: '2026-03-10',
      status: 'en_cours',
      feedbackText: 'Besoin de plus de communication',
      solutionText: 'Rituel hebdomadaire',
      isAnonymous: true
    }
  });
});
