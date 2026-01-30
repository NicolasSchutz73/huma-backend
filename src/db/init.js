const db = require('./index');

const initDb = async () => {
  try {
    await db.query('BEGIN');

    await db.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('employee', 'manager', 'director', 'admin')),
        first_name TEXT,
        last_name TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        onboarding_completed BOOLEAN DEFAULT FALSE,
        work_style TEXT CHECK (work_style IN ('Collaboratif', 'Autonome', 'Structuré', 'Flexible')),
        motivation_type TEXT CHECK (motivation_type IN ('Reconnaissance', 'Apprentissage', 'Impact', 'Équilibre')),
        stress_source TEXT CHECK (stress_source IN ('Charge de travail', 'Relations', 'Incertitude', 'Délais')),
        current_level INTEGER DEFAULT 1,
        total_xp INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (team_id, user_id),
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS check_ins (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mood_value INTEGER NOT NULL CHECK (mood_value >= 1 AND mood_value <= 100),
        causes TEXT,
        comment TEXT,
        "timestamp" TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('WORKLOAD', 'RELATIONS', 'MOTIVATION', 'ORGANIZATION', 'RECOGNITION', 'WORK_LIFE_BALANCE', 'FACILITIES')),
        feedback_text TEXT NOT NULL,
        solution_text TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'vu', 'en_cours', 'resolu', 'archive')),
        is_anonymous BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(organization_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(organization_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_check_ins_user_timestamp ON check_ins(user_id, "timestamp")');
    await db.query('CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON feedbacks(user_id)');

    await db.query('COMMIT');
  } catch (err) {
    try {
      await db.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Erreur lors du rollback init DB:', rollbackErr.message);
    }
    console.error("Erreur lors de l'init PostgreSQL:", err.message);
  }
};

module.exports = initDb;
