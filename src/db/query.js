const db = require('./index');

const run = async (sql, params = []) => {
  const result = await db.query(sql, params);
  return { rowCount: result.rowCount };
};

const get = async (sql, params = []) => {
  const result = await db.query(sql, params);
  return result.rows[0] || null;
};

const all = async (sql, params = []) => {
  const result = await db.query(sql, params);
  return result.rows;
};

module.exports = {
  run,
  get,
  all
};
