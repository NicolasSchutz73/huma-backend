const { z } = require('zod');

const Feedback = z.object({
  id: z.string(),
  user_id: z.string(),
  category: z.enum([
    'WORKLOAD',
    'RELATIONS',
    'MOTIVATION',
    'ORGANIZATION',
    'RECOGNITION',
    'WORK_LIFE_BALANCE',
    'FACILITIES'
  ]),
  feedback_text: z.string(),
  solution_text: z.string(),
  status: z.enum(['pending', 'vu', 'en_cours', 'resolu', 'archive']).optional(),
  is_anonymous: z.boolean().optional(),
  created_at: z.string().optional()
});

module.exports = {
  Feedback
};
