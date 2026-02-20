const jwt = require('jsonwebtoken');
const db = require('../db/query');
const { AppError } = require('../utils/errors');
const { jwtSecret } = require('../config');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [, token] = authHeader.split(' ');

  if (!token) {
    return next(new AppError('Unauthorized: Missing Bearer token', 401, 'UNAUTHORIZED'));
  }

  if (!jwtSecret) {
    return next(new AppError('JWT secret not configured', 500, 'CONFIG_ERROR'));
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const userId = payload.sub;
    if (!userId) {
      return next(new AppError('Unauthorized: Invalid token', 401, 'UNAUTHORIZED'));
    }

    const row = await db.get('SELECT * FROM users WHERE id = $1', [userId]);
    if (!row) {
      return next(new AppError('Unauthorized: Invalid User ID', 401, 'UNAUTHORIZED'));
    }

    req.user = row;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Unauthorized: Token expired', 401, 'UNAUTHORIZED'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Unauthorized: Invalid token', 401, 'UNAUTHORIZED'));
    }
    next(err);
  }
};

module.exports = authenticate;
