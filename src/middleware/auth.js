const db = require('../db/query');
const { AppError } = require('../utils/errors');

const authenticate = async (req, res, next) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return next(new AppError('Unauthorized: Missing X-User-Id header', 401, 'UNAUTHORIZED'));
  }

  try {
    const row = await db.get('SELECT * FROM users WHERE id = $1', [userId]);
    if (!row) {
      return next(new AppError('Unauthorized: Invalid User ID', 401, 'UNAUTHORIZED'));
    }

    req.user = row;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authenticate;
