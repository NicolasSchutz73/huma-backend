const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const VALID_CATEGORIES = ['WORKLOAD', 'RELATIONS', 'MOTIVATION', 'ORGANIZATION', 'RECOGNITION', 'WORK_LIFE_BALANCE', 'FACILITIES'];

const getFeedbacks = (req, res) => {
  const userId = req.user.id;

  const sql = `
    SELECT id, category, date(created_at) as date, status, feedback_text, is_anonymous
    FROM feedbacks
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const feedbacks = rows.map(row => ({
      id: row.id,
      category: row.category,
      date: row.date,
      status: row.status,
      preview: row.feedback_text.length > 30 ? row.feedback_text.substring(0, 30) + '...' : row.feedback_text,
      isAnonymous: !!row.is_anonymous
    }));

    res.status(200).json(feedbacks);
  });
};

const createFeedback = (req, res) => {
  const userId = req.user.id;
  const { category, feedbackText, solutionText, isAnonymous } = req.body;

  if (!category) {
    return res.status(400).json({ error: 'category is required' });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({
      error: `Invalid category: ${category}. Valid categories are: ${VALID_CATEGORIES.join(', ')}`
    });
  }

  if (!feedbackText) {
    return res.status(400).json({ error: 'feedbackText is required' });
  }

  if (!solutionText) {
    return res.status(400).json({ error: 'solutionText is required' });
  }

  const id = uuidv4();
  const anonymous = isAnonymous !== false ? 1 : 0;

  const sql = `
    INSERT INTO feedbacks (id, user_id, category, feedback_text, solution_text, is_anonymous)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [id, userId, category, feedbackText, solutionText, anonymous], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.status(201).json({
      message: 'Feedback créé avec succès',
      feedback: {
        id,
        category,
        feedbackText,
        solutionText,
        status: 'pending',
        isAnonymous: !!anonymous
      }
    });
  });
};

module.exports = {
  getFeedbacks,
  createFeedback,
};
