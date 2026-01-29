const { z } = require('zod');

const TeamMember = z.object({
  id: z.string(),
  team_id: z.string(),
  user_id: z.string(),
  joined_at: z.string().optional()
});

module.exports = {
  TeamMember
};
