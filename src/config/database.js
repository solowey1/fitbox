const { Pool, types } = require('pg');
require('dotenv').config();

// DATE отдаём строкой 'ГГГГ-ММ-ДД': по умолчанию pg превращает её в полночь
// по часовому поясу сервера, и в JSON дата съезжает на день
types.setTypeParser(types.builtins.DATE, (value) => value);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fitbox',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
