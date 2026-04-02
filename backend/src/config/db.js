'use strict';

require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set!');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
});

pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error',   (err) => console.error('❌ Pool error:', err.message));

pool.query('SELECT NOW()')
  .then(() => console.log('✅ PostgreSQL connection verified'))
  .catch((err) => console.error('❌ DB startup check failed:', err.message));

module.exports = pool;
