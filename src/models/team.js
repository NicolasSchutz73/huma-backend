const { z } = require('zod');

const Team = z.object({
  id: z.string(),
  organization_id: z.string(),
  name: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

module.exports = {
  Team
};
