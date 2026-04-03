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
  .then(() => {
    console.log('✅ PostgreSQL connection verified');
    // ── Auto-migrate: ensure Google OAuth columns exist ───────
    return pool.query(`
      ALTER TABLE cprofiles ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
      ALTER TABLE cprofiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE cprofiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `);
  })
  .then(() => console.log('✅ Schema migration check complete'))
  .catch((err) => console.error('❌ DB startup check failed:', err.message));

module.exports = pool;

