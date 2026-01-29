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

module.exports = {
  updateUserInfo,
  completeOnboarding
};
