const { z } = require('zod');

const dbDateTime = z.union([z.string(), z.date()]);
const dbDate = z.union([z.string(), z.date()]);

const UserWeeklyInsight = z.object({
  id: z.string(),
  user_id: z.string(),
  week_start: dbDate,
  week_end: dbDate,
  payload_json: z.any(),
  generated_at: dbDateTime.nullable().optional(),
  created_by_user_id: z.string().nullable().optional(),
  updated_by_user_id: z.string().nullable().optional(),
  created_at: dbDateTime.optional(),
  updated_at: dbDateTime.optional()
});

module.exports = {
  UserWeeklyInsight
};
