const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to connect to PostgreSQL.');
}

const sslEnabled =
  process.env.DATABASE_SSL === 'true' ||
  process.env.PGSSL === 'true' ||
  process.env.NODE_ENV === 'production' ||
  /sslmode=require/i.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Erreur de connexion à PostgreSQL:', err.message);
});

module.exports = pool;
