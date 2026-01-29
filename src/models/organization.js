const { z } = require('zod');

const Organization = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

module.exports = {
  Organization
};
