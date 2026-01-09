const db = require('../db');

const authenticate = (req, res, next) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing X-User-Id header' });
  }

  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      return res.status(401).json({ error: 'Unauthorized: Invalid User ID' });
    }

    req.user = row;
    next();
  });
};

module.exports = authenticate;
