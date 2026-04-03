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

// ══════════════════════════════════════════════════════════════
// ── POST /api/auth/google — Google Sign-In with ID Token ─────
// ══════════════════════════════════════════════════════════════
const googleAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken)
    return err(res, 'Google ID token is required', 400);

  // ── Step 1: Verify the ID token with Google ────────────────
  let payload;
  try {
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    const response = await fetch(verifyUrl);
    payload = await response.json();

    if (payload.error_description) {
      console.error('[GoogleAuth] Token verification failed:', payload.error_description);
      return err(res, 'Invalid Google token', 401);
    }

    // Verify audience matches our client ID
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && clientId !== 'your_google_client_id_here' && payload.aud !== clientId) {
      console.error('[GoogleAuth] Token audience mismatch:', payload.aud, '!==', clientId);
      return err(res, 'Token audience mismatch', 401);
    }
  } catch (e) {
    console.error('[GoogleAuth] Token verification error:', e.message);
    return err(res, 'Failed to verify Google token', 500);
  }

  const googleId   = payload.sub;
  const email      = payload.email;
  const fullName   = payload.name || '';
  const avatarUrl  = payload.picture ? JSON.stringify(payload.picture) : null;

  if (!googleId || !email) {
    return err(res, 'Invalid token payload — missing sub or email', 400);
  }

  // ── Step 2: Find or create user ────────────────────────────
  let user;
  let isNewUser = false;

  // Check by google_id first (returning user)
  const byGoogleId = await pool.query(
    `SELECT * FROM cprofiles WHERE google_id = $1 LIMIT 1`,
    [googleId]
  );

  if (byGoogleId.rows.length > 0) {
    // ── Returning Google user — update name/avatar if changed ─
    user = byGoogleId.rows[0];
    await pool.query(
      `UPDATE cprofiles
       SET full_name  = COALESCE(NULLIF($1, ''), full_name),
           avatar_url = COALESCE($2::jsonb, avatar_url),
           email      = COALESCE($3, email)
       WHERE google_id = $4`,
      [fullName, avatarUrl, email, googleId]
    );
    user.full_name  = fullName || user.full_name;
    user.avatar_url = avatarUrl || user.avatar_url;
    user.email      = email || user.email;
  } else {
    // Check by email (user may have registered via phone with same email)
    const byEmail = await pool.query(
      `SELECT * FROM cprofiles WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (byEmail.rows.length > 0) {
      // ── Link Google ID to existing account ──────────────────
      user = byEmail.rows[0];
      await pool.query(
        `UPDATE cprofiles
         SET google_id  = $1,
             avatar_url = COALESCE($2::jsonb, avatar_url),
             full_name  = COALESCE(NULLIF($3, ''), full_name)
         WHERE id = $4`,
        [googleId, avatarUrl, fullName, user.id]
      );
      user.google_id  = googleId;
      user.avatar_url = avatarUrl || user.avatar_url;
    } else {
      // ── Brand new user via Google ────────────────────────────
      const inserted = await pool.query(
        `INSERT INTO cprofiles (google_id, email, full_name, avatar_url, created_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW())
         RETURNING *`,
        [googleId, email, fullName, avatarUrl]
      );
      user = inserted.rows[0];
      isNewUser = true;
    }
  }

  // ── Step 3: Issue JWT ──────────────────────────────────────
  const token = jwt.sign(
    {
      userId: user.id,
      phone:  user.phone_text || '',
      name:   user.full_name || '',
      email:  user.email || email,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );

  // Parse avatar_url from jsonb to plain string
  const userAvatarUrl = typeof user.avatar_url === 'string' ? user.avatar_url : (user.avatar_url || null);

  return ok(res, {
    token,
    isNewUser,
    user: {
      id:         user.id,
      phone:      user.phone_text || '',
      name:       user.full_name || fullName,
      email:      user.email || email,
      avatar_url: userAvatarUrl,
      google_id:  googleId,
    }
  }, isNewUser ? 'Account created via Google' : 'Google login successful');
});

// ── PUT /api/auth/google/complete — Save phone after Google sign-in ──
const completeGoogleProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { phone, name } = req.body;

  if (!phone || !/^\d{10}$/.test(String(phone)))
    return err(res, 'Valid 10-digit phone number required', 400);

  const phoneStr = String(phone);

  // Check if phone is already taken by another user
  const existing = await pool.query(
    `SELECT id FROM cprofiles WHERE phone_text = $1 AND id != $2 LIMIT 1`,
    [phoneStr, userId]
  );

  if (existing.rows.length > 0) {
    return err(res, 'This phone number is already linked to another account', 409);
  }

  const { rows } = await pool.query(
    `UPDATE cprofiles
     SET phone      = $1,
         phone_text = $2,
         full_name  = COALESCE(NULLIF($3, ''), full_name)
     WHERE id = $4
     RETURNING id, phone_text AS phone, full_name, email, avatar_url, google_id`,
    [Number(phoneStr), phoneStr, name || '', userId]
  );

  if (!rows.length) return err(res, 'User not found', 404);

  // Re-issue JWT with updated phone
  const user = rows[0];
  const token = jwt.sign(
    {
      userId: user.id,
      phone:  user.phone || '',
      name:   user.full_name || '',
      email:  user.email || '',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );

  return ok(res, { token, user }, 'Profile completed');
});

// ── GET /api/auth/profile (protected) ───────────────────────
const getProfile = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, phone_text AS phone, full_name, email, avatar_url, google_id, created_at
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
     RETURNING id, phone_text AS phone, full_name, email, avatar_url`,
    [name || '', email || '', req.user.userId]
  );
  if (!rows.length) return err(res, 'User not found', 404);
  return ok(res, rows[0], 'Profile updated');
});

module.exports = { sendOtp, verifyOtp, googleAuth, completeGoogleProfile, getProfile, updateProfile };
