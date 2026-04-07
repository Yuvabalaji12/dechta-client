'use strict';

const pool         = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ok, err }  = require('../utils/response');

// ── POST /api/addresses ──────────────────────────────────────
const saveAddress = asyncHandler(async (req, res) => {
  const { tag, address_text, is_default = false } = req.body;
  const userId = req.user.userId;

  if (!address_text || !address_text.trim())
    return err(res, 'address_text is required', 400);

  const validTags = ['home', 'office', 'other'];
  const normalizedTag = (tag || 'other').toLowerCase();
  if (!validTags.includes(normalizedTag))
    return err(res, `tag must be one of: ${validTags.join(', ')}`, 400);

  // If this address is set as default, unset all others first
  if (is_default) {
    await pool.query(
      `UPDATE public.addresses SET is_default = false WHERE user_id = $1`,
      [userId]
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO public.addresses (user_id, tag, address_text, is_default, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [userId, normalizedTag, address_text.trim(), is_default]
  );

  return ok(res, rows[0], 'Address saved', 201);
});

// ── GET /api/addresses ───────────────────────────────────────
const getAddresses = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, tag, address_text, is_default, created_at
     FROM public.addresses
     WHERE user_id = $1
     ORDER BY is_default DESC, created_at DESC`,
    [req.user.userId]
  );
  return ok(res, rows);
});

// ── PUT /api/addresses/:id ───────────────────────────────────
const updateAddress = asyncHandler(async (req, res) => {
  const { id }   = req.params;
  const userId   = req.user.userId;
  const { tag, address_text, is_default } = req.body;

  // Ownership check
  const existing = await pool.query(
    `SELECT id FROM public.addresses WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (!existing.rows.length) return err(res, 'Address not found', 404);

  const validTags = ['home', 'office', 'other'];
  const normalizedTag = tag ? tag.toLowerCase() : undefined;
  if (normalizedTag && !validTags.includes(normalizedTag))
    return err(res, `tag must be one of: ${validTags.join(', ')}`, 400);

  // Unset other defaults if setting this as default
  if (is_default) {
    await pool.query(
      `UPDATE public.addresses SET is_default = false WHERE user_id = $1`,
      [userId]
    );
  }

  const { rows } = await pool.query(
    `UPDATE public.addresses
     SET tag          = COALESCE($1, tag),
         address_text = COALESCE($2, address_text),
         is_default   = COALESCE($3, is_default)
     WHERE id = $4 AND user_id = $5
     RETURNING *`,
    [normalizedTag || null, address_text?.trim() || null, is_default ?? null, id, userId]
  );

  return ok(res, rows[0], 'Address updated');
});

// ── DELETE /api/addresses/:id ────────────────────────────────
const deleteAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const { rowCount } = await pool.query(
    `DELETE FROM public.addresses WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (!rowCount) return err(res, 'Address not found', 404);
  return ok(res, null, 'Address deleted');
});

module.exports = { saveAddress, getAddresses, updateAddress, deleteAddress };
