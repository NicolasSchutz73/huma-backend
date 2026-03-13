const { z } = require('zod');

const TeamWeeklyReport = z.object({
  id: z.string(),
  team_id: z.string(),
  week_start: z.string(),
  week_end: z.string(),
  report_type: z.string(),
  payload_json: z.any(),
  generation_count: z.number().int(),
  generated_at: z.string().nullable().optional(),
  created_by_user_id: z.string().nullable().optional(),
  updated_by_user_id: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

module.exports = {
  TeamWeeklyReport
};
