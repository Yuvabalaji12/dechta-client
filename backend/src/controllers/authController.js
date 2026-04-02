'use strict';

const jwt          = require('jsonwebtoken');
const pool         = require('../config/db');
const otpService   = require('../services/otp.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, err }  = require('../utils/response');

// ── POST /api/auth/send-otp ──────────────────────────────────
const sendOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone || !/^\d{10}$/.test(String(phone)))
    return err(res, 'Valid 10-digit phone number required', 400);

  await otpService.generateOtp(String(phone));

  return ok(res, { phone }, 'OTP sent. Use 1234 for testing.');
});

// ── POST /api/auth/verify-otp ────────────────────────────────
const verifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp, name } = req.body;

  if (!phone || !otp)
    return err(res, 'Phone and OTP are required', 400);

  const result = await otpService.verifyOtp(String(phone), String(otp));
  if (!result.valid)
    return err(res, result.reason, 400);

  // ── Safe upsert: cprofiles.phone is NUMERIC with no unique constraint ──
  // We use phone_text column (VARCHAR, unique) added by migration.sql
  const existing = await pool.query(
    `SELECT * FROM cprofiles WHERE phone_text = $1 LIMIT 1`,
    [String(phone)]
  );

  let user;
  if (existing.rows.length > 0) {
    const updated = await pool.query(
      `UPDATE cprofiles
       SET full_name = COALESCE(NULLIF($1, ''), full_name)
       WHERE phone_text = $2
       RETURNING *`,
      [name || '', String(phone)]
    );
    user = updated.rows[0];
  } else {
    const inserted = await pool.query(
      `INSERT INTO cprofiles (phone, phone_text, full_name, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [Number(phone), String(phone), name || '']
    );
    user = inserted.rows[0];
  }

  const token = jwt.sign(
    { userId: user.id, phone: String(phone), name: user.full_name || '' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );

  return ok(res, {
    token,
    user: {
      id:    user.id,
      phone: String(phone),
      name:  user.full_name || '',
      email: user.email || null,
    }
  }, 'Login successful');
});

// ── GET /api/auth/profile (protected) ───────────────────────
const getProfile = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, phone_text AS phone, full_name, email, avatar_url, created_at
     FROM cprofiles WHERE id = $1`,
    [req.user.userId]
  );
  if (!rows.length) return err(res, 'User not found', 404);
  return ok(res, rows[0]);
});

// ── PUT /api/auth/profile (protected) ────────────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const { rows } = await pool.query(
    `UPDATE cprofiles
     SET full_name = COALESCE(NULLIF($1,''), full_name),
         email     = COALESCE(NULLIF($2,''), email)
     WHERE id = $3
     RETURNING id, phone_text AS phone, full_name, email`,
    [name || '', email || '', req.user.userId]
  );
  if (!rows.length) return err(res, 'User not found', 404);
  return ok(res, rows[0], 'Profile updated');
});

module.exports = { sendOtp, verifyOtp, getProfile, updateProfile };
