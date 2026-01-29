const { z } = require('zod');

const User = z.object({
  id: z.string(),
  organization_id: z.string(),
  email: z.string().email(),
  role: z.enum(['employee', 'manager', 'director', 'admin']),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  is_active: z.number().int().optional(),
  onboarding_completed: z.number().int().optional(),
  work_style: z.string().nullable().optional(),
  motivation_type: z.string().nullable().optional(),
  stress_source: z.string().nullable().optional(),
  current_level: z.number().int().optional(),
  total_xp: z.number().int().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

module.exports = {
  User
};
