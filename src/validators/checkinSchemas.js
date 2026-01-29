const { z } = require('zod');

const VALID_CAUSES = ['WORKLOAD', 'RELATIONS', 'MOTIVATION', 'CLARITY', 'RECOGNITION', 'BALANCE'];

const createCheckin = z.object({
  body: z.object({
    moodValue: z.coerce.number().int().min(1).max(100),
    causes: z.array(z.enum(VALID_CAUSES)).optional(),
    comment: z.string().optional(),
    timestamp: z.string().min(1)
  })
});

const history = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).optional()
  })
});

const weeklySummary = z.object({
  query: z.object({
    weekStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
  })
});

module.exports = {
  createCheckin,
  history,
  weeklySummary
};
