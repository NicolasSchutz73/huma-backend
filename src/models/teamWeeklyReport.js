const { z } = require('zod');

const dbDateTime = z.union([z.string(), z.date()]);
const dbDate = z.union([z.string(), z.date()]);

const TeamWeeklyReport = z.object({
  id: z.string(),
  team_id: z.string(),
  week_start: dbDate,
  week_end: dbDate,
  report_type: z.string(),
  payload_json: z.any(),
  generation_count: z.number().int(),
  generated_at: dbDateTime.nullable().optional(),
  created_by_user_id: z.string().nullable().optional(),
  updated_by_user_id: z.string().nullable().optional(),
  created_at: dbDateTime.optional(),
  updated_at: dbDateTime.optional()
});

module.exports = {
  TeamWeeklyReport
};
