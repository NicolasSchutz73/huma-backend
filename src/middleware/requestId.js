const { randomUUID } = require('crypto');

const requestId = (req, res, next) => {
  const headerId = req.headers['x-request-id'];
  req.id = typeof headerId === 'string' && headerId.length > 0 ? headerId : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

module.exports = requestId;
