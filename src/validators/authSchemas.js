const { z } = require('zod');

const register = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
});

const login = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
});

module.exports = {
  register,
  login
};
