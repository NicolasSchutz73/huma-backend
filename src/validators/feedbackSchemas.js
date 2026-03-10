const { z } = require('zod');

const VALID_CATEGORIES = [
  'WORKLOAD',
  'RELATIONS',
  'MOTIVATION',
  'ORGANIZATION',
  'RECOGNITION',
  'WORK_LIFE_BALANCE',
  'FACILITIES'
];

const createFeedback = z.object({
  body: z.object({
    category: z.enum(VALID_CATEGORIES),
    feedbackText: z.string().min(1),
    solutionText: z.string().min(1),
    isAnonymous: z.boolean().optional()
  })
});

const FEEDBACK_STATUSES = ['pending', 'vu', 'en_cours', 'resolu', 'archive'];

const updateFeedbackStatus = z.object({
  params: z.object({
    id: z.string().min(1)
  }),
  body: z.object({
    status: z.enum(FEEDBACK_STATUSES)
  })
});

module.exports = {
  createFeedback,
  updateFeedbackStatus
};
