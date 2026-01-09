const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const VALID_CAUSES = ['WORKLOAD', 'RELATIONS', 'MOTIVATION', 'CLARITY', 'RECOGNITION', 'BALANCE'];

const getTodayCheckin = (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const sql = `
    SELECT id FROM check_ins
    WHERE user_id = ? AND date(timestamp) = date(?)
    LIMIT 1
  `;

  db.get(sql, [userId, today], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.status(200).json({ hasCheckedIn: !!row });
  });
};

const createCheckin = (req, res) => {
  const userId = req.user.id;
  const { moodValue, causes, comment, timestamp } = req.body;

  if (moodValue === undefined || moodValue === null) {
    return res.status(400).json({ error: 'moodValue is required' });
  }

  if (moodValue < 1 || moodValue > 100) {
    return res.status(400).json({ error: 'moodValue must be between 1 and 100' });
  }

  if (!timestamp) {
    return res.status(400).json({ error: 'timestamp is required' });
  }

  if (causes && Array.isArray(causes)) {
    const invalidCauses = causes.filter(cause => !VALID_CAUSES.includes(cause));
    if (invalidCauses.length > 0) {
      return res.status(400).json({
        error: `Invalid causes: ${invalidCauses.join(', ')}. Valid causes are: ${VALID_CAUSES.join(', ')}`
      });
    }
  }

  const checkinDate = new Date(timestamp).toISOString().split('T')[0];

  const checkSql = `
    SELECT id FROM check_ins
    WHERE user_id = ? AND date(timestamp) = date(?)
    LIMIT 1
  `;

  db.get(checkSql, [userId, checkinDate], (err, existingCheckin) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (existingCheckin) {
      return res.status(409).json({ error: 'Un check-in existe déjà pour cette date' });
    }

    const id = uuidv4();
    const causesJson = causes ? JSON.stringify(causes) : null;

    const insertSql = `
      INSERT INTO check_ins (id, user_id, mood_value, causes, comment, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(insertSql, [id, userId, moodValue, causesJson, comment || null, timestamp], function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.status(201).json({
        message: 'Check-in créé avec succès',
        checkin: {
          id,
          moodValue,
          causes: causes || [],
          comment: comment || null,
          timestamp
        }
      });
    });
  });
};

const getHistory = (req, res) => {
  const userId = req.user.id;
  const { days = 30 } = req.query;

  const sql = `
    SELECT date(timestamp) as date, mood_value as moodValue
    FROM check_ins
    WHERE user_id = ? AND timestamp >= date('now', '-' || ? || ' days')
    ORDER BY timestamp DESC
  `;

  db.all(sql, [userId, parseInt(days)], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const checkinsByDate = {};
    rows.forEach(row => {
      checkinsByDate[row.date] = row.moodValue;
    });

    const history = [];
    const today = new Date();

    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      if (checkinsByDate[dateStr] !== undefined) {
        history.push({
          date: dateStr,
          status: 'completed',
          moodValue: checkinsByDate[dateStr]
        });
      } else {
        history.push({
          date: dateStr,
          status: 'missed',
          moodValue: null
        });
      }
    }

    res.status(200).json(history);
  });
};

module.exports = {
  getTodayCheckin,
  createCheckin,
  getHistory,
};
