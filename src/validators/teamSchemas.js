const { z } = require('zod');

const createTeam = z.object({
  body: z.object({
    name: z.string().min(1),
    organizationId: z.string().min(1).optional()
  })
});

const addMember = z.object({
  body: z.object({
    teamId: z.string().min(1),
    userId: z.string().min(1)
  })
});

const stats = z.object({
  query: z.object({
    teamId: z.string().min(1).optional()
  })
});

module.exports = {
  createTeam,
  addMember,
  stats
};
