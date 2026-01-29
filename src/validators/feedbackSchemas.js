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

module.exports = {
  createFeedback
};
