const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const register = (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // 1. Vérifier ou créer une organisation par défaut (car organization_id est NOT NULL)
  // Dans un vrai cas, on sélectionnerait l'organisation invitante ou on en créerait une nouvelle.
  const getOrgPromise = new Promise((resolve, reject) => {
    db.get('SELECT id FROM organizations LIMIT 1', (err, row) => {
      if (err) reject(err);
      if (row) {
        resolve(row.id);
      } else {
        const newOrgId = uuidv4();
        db.run('INSERT INTO organizations (id, name) VALUES (?, ?)', [newOrgId, 'Default Organization'], (err) => {
          if (err) reject(err);
          else resolve(newOrgId);
        });
      }
    });
  });

  getOrgPromise
    .then((orgId) => {
      // 2. Créer l'utilisateur
      const userId = uuidv4();
      const role = 'employee'; // Rôle par défaut

      const sql = `
        INSERT INTO users (id, email, organization_id, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `;

      db.run(sql, [userId, email, orgId, role], function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: err.message });
        }

        res.status(201).json({
          message: 'User registered successfully',
          user: {
            id: userId,
            email: email,
            role: role,
            organization_id: orgId
          }
        });
      });
    })
    .catch((err) => {
      res.status(500).json({ error: 'Organization setup failed: ' + err.message });
    });
};

module.exports = {
  register,
};
