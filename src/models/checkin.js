const { z } = require('zod');

const Checkin = z.object({
  id: z.string(),
  user_id: z.string(),
  mood_value: z.number().int(),
  causes: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  timestamp: z.string(),
  created_at: z.string().optional()
});

module.exports = {
  Checkin
};
