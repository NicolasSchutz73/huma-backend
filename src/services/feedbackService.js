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
  const anonymous = isAnonymous !== false ? 1 : 0;

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
      isAnonymous: !!anonymous
    }
  };
};

module.exports = {
  getFeedbacks,
  createFeedback
};
