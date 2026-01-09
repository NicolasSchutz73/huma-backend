const db = require('../db');

const updateUserInfo = (req, res) => {
  const { first_name, last_name } = req.body;
  const userId = req.user.id; // Vient du middleware auth

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  const sql = `
    UPDATE users 
    SET first_name = ?, last_name = ?, updated_at = datetime('now')
    WHERE id = ?
  `;

  db.run(sql, [first_name, last_name, userId], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Récupérer l'utilisateur mis à jour pour le renvoyer
    db.get('SELECT id, email, first_name, last_name FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) return res.status(500).json({error: "Update success but fetch failed"});
        
        res.status(200).json({
            message: 'User info updated successfully',
            user: row
        });
    });
  });
};

const completeOnboarding = (req, res) => {
  let { work_style, motivation_type, stress_source } = req.body;
  const userId = req.user.id;

  // Normalisation des accents (accepte les versions avec ou sans accent)
  const normalizeMap = {
    'Structure': 'Structuré',
    'Equilibre': 'Équilibre',
    'Delais': 'Délais'
  };

  work_style = normalizeMap[work_style] || work_style;
  motivation_type = normalizeMap[motivation_type] || motivation_type;
  stress_source = normalizeMap[stress_source] || stress_source;

  const validWorkStyles = ['Collaboratif', 'Autonome', 'Structuré', 'Flexible'];
  const validMotivationTypes = ['Reconnaissance', 'Apprentissage', 'Impact', 'Équilibre'];
  const validStressSources = ['Charge de travail', 'Relations', 'Incertitude', 'Délais'];

  if (!validWorkStyles.includes(work_style)) {
    return res.status(400).json({ error: `Invalid work_style. Must be one of: ${validWorkStyles.join(', ')}` });
  }
  if (!validMotivationTypes.includes(motivation_type)) {
    return res.status(400).json({ error: `Invalid motivation_type. Must be one of: ${validMotivationTypes.join(', ')}` });
  }
  if (!validStressSources.includes(stress_source)) {
    return res.status(400).json({ error: `Invalid stress_source. Must be one of: ${validStressSources.join(', ')}` });
  }

  const sql = `
    UPDATE users 
    SET work_style = ?, motivation_type = ?, stress_source = ?, onboarding_completed = 1, updated_at = datetime('now')
    WHERE id = ?
  `;

  db.run(sql, [work_style, motivation_type, stress_source, userId], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.status(200).json({
      message: 'Onboarding completed successfully'
    });
  });
};

module.exports = {
  updateUserInfo,
  completeOnboarding,
};
