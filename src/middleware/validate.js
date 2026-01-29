const { ZodError } = require('zod');
const { AppError } = require('../utils/errors');

const formatZodError = (error) => {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'value';
      return `${path}: ${issue.message}`;
    })
    .join(', ');
};

const validate = (schema) => (req, _res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    });

    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query;
    if (parsed.params) req.params = parsed.params;

    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return next(new AppError(formatZodError(err), 400, 'VALIDATION_ERROR'));
    }
    next(err);
  }
};

module.exports = validate;
