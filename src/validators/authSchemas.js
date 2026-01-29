const { z } = require('zod');

const register = z.object({
  body: z.object({
    email: z.string().email()
  })
});

const login = z.object({
  body: z.object({
    email: z.string().email()
  })
});

module.exports = {
  register,
  login
};
