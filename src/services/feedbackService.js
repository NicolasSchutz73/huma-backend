const { v4: uuidv4 } = require('uuid');
const feedbackRepository = require('../repositories/feedbackRepository');
const { AppError } = require('../utils/errors');

const VALID_CATEGORIES = [
  'WORKLOAD',
  'RELATIONS',
  'MOTIVATION',
  'ORGANIZATION',
  'RECOGNITION',
  'WORK_LIFE_BALANCE',
  'FACILITIES'
];
const VALID_STATUSES = ['pending', 'vu', 'en_cours', 'resolu', 'archive'];

const listPublicFeedbacks = async () => {
  const rows = await feedbackRepository.listAll();

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    date: row.date,
    status: row.status,
    feedbackText: row.feedback_text,
    solutionText: row.solution_text,
    isAnonymous: !!row.is_anonymous
  }));
};

const getFeedbacks = async ({ userId }) => {
  const rows = await feedbackRepository.listByUserId(userId);

  return rows.map(row => ({
    id: row.id,
    category: row.category,
    date: row.date,
    status: row.status,
    preview: row.feedback_text.length > 30 ? row.feedback_text.substring(0, 30) + '...' : row.feedback_text,
    isAnonymous: !!row.is_anonymous
  }));
};

const createFeedback = async ({ userId, category, feedbackText, solutionText, isAnonymous }) => {
  if (!category) {
    throw new AppError('category is required', 400, 'VALIDATION_ERROR');
  }

  if (!VALID_CATEGORIES.includes(category)) {
    throw new AppError(
      `Invalid category: ${category}. Valid categories are: ${VALID_CATEGORIES.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  if (!feedbackText) {
    throw new AppError('feedbackText is required', 400, 'VALIDATION_ERROR');
  }

  if (!solutionText) {
    throw new AppError('solutionText is required', 400, 'VALIDATION_ERROR');
  }

  const id = uuidv4();
  const anonymous = isAnonymous !== false;

  await feedbackRepository.createFeedback({
    id,
    userId,
    category,
    feedbackText,
    solutionText,
    isAnonymous: anonymous
  });

  return {
    message: 'Feedback créé avec succès',
    feedback: {
      id,
      category,
      feedbackText,
      solutionText,
      status: 'pending',
      isAnonymous: anonymous
    }
  };
};

const updateFeedbackStatus = async ({ feedbackId, status, userRole }) => {
  if (!['manager', 'admin'].includes(userRole)) {
    throw new AppError('Forbidden: manager or admin role required', 403, 'FORBIDDEN');
  }

  if (!VALID_STATUSES.includes(status)) {
    throw new AppError(
      `Invalid status: ${status}. Valid statuses are: ${VALID_STATUSES.join(', ')}`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const existingFeedback = await feedbackRepository.getById(feedbackId);
  if (!existingFeedback) {
    throw new AppError('Feedback not found', 404, 'NOT_FOUND');
  }

  await feedbackRepository.updateStatus({ feedbackId, status });

  return {
    message: 'Statut du feedback mis à jour',
    feedback: {
      id: existingFeedback.id,
      category: existingFeedback.category,
      date: existingFeedback.date,
      status,
      feedbackText: existingFeedback.feedback_text,
      solutionText: existingFeedback.solution_text,
      isAnonymous: !!existingFeedback.is_anonymous
    }
  };
};

module.exports = {
  listPublicFeedbacks,
  getFeedbacks,
  createFeedback,
  updateFeedbackStatus
};
