const { z } = require('zod');

const updateUserInfo = z.object({
  body: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1)
  })
});

const completeOnboarding = z.object({
  body: z.object({
    work_style: z.string().min(1),
    motivation_type: z.string().min(1),
    stress_source: z.string().min(1)
  })
});

const weeklyInsight = z.object({
  query: z.object({
    weekStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
  })
});

module.exports = {
  updateUserInfo,
  completeOnboarding,
  weeklyInsight
};
