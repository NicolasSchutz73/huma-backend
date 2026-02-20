const { z } = require('zod');

const createTeam = z.object({
  body: z.object({
    name: z.string().min(1),
    organizationId: z.string().min(1).optional()
  })
});

const addMember = z.object({
  body: z.object({
    teamId: z.string().min(1),
    userId: z.string().min(1)
  })
});

const stats = z.object({
  query: z.object({
    teamId: z.string().min(1).optional()
  })
});

const weeklySummary = z.object({
  query: z.object({
    teamId: z.string().min(1).optional(),
    weekStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    period: z.enum(['week', 'month', 'year']).optional(),
    date: z
      .string()
      .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
      .optional()
  })
});

module.exports = {
  createTeam,
  addMember,
  stats,
  weeklySummary,
  weeklyFactors: weeklySummary
};
