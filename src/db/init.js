const db = require('./index');

const initDb = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error("Erreur table organizations:", err);
      else console.log("Table 'organizations' prête.");
    });

    // 2. Création de la table users
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('employee', 'manager', 'director', 'admin')),
      first_name TEXT,
      last_name TEXT,
      is_active INTEGER DEFAULT 1,
      onboarding_completed INTEGER DEFAULT 0,
      work_style TEXT CHECK (work_style IN ('Collaboratif', 'Autonome', 'Structuré', 'Flexible')),
      motivation_type TEXT CHECK (motivation_type IN ('Reconnaissance', 'Apprentissage', 'Impact', 'Équilibre')),
      stress_source TEXT CHECK (stress_source IN ('Charge de travail', 'Relations', 'Incertitude', 'Délais')),
      current_level INTEGER DEFAULT 1,
      total_xp INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )`, (err) => {
      if (err) console.error("Erreur table users:", err);
      else console.log("Table 'users' prête.");
    });
  });
};

initDb();
