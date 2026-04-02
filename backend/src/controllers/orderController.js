'use strict';

const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ok, err } = require('../utils/response');

// ── POST /api/orders ─────────────────────────────────────────
const createOrder = asyncHandler(async (req, res) => {
  const {
    items,
    total_amount,
    delivery_address,
    customer_name,
    customer_phone,
    schedule,
    instructions,
    tip,
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0)
    return err(res, 'Order items are required', 400);

  if (!total_amount || isNaN(total_amount))
    return err(res, 'total_amount is required', 400);

  const phone = customer_phone || req.user?.phone || null;
  const name  = customer_name  || req.user?.name  || null;

  // Insert main booking record
  const { rows } = await pool.query(
    `INSERT INTO bookings (user_id, status, total_amount, booking_date, booking_time, items_json, created_at)
     VALUES ($1, 'Pending', $2, $3, $4, $5, NOW())
     RETURNING *`,
    [
      req.user.userId,
      total_amount,
      schedule?.date || new Date().toLocaleDateString('en-IN'),
      schedule?.time || new Date().toLocaleTimeString('en-IN'),
      JSON.stringify({ items, delivery_address, instructions, tip }),
    ]
  );

  const booking = rows[0];

  // Create order records per vendor (items grouped by vendor_id)
  // Handles both vendor_id (snake_case) and vendorId (camelCase) from frontend
  const vendorGroups = {};
  for (const item of items) {
    const vid = item.vendor_id || item.vendorId || 'unknown';
    if (!vendorGroups[vid]) vendorGroups[vid] = [];
    vendorGroups[vid].push(item);
  }

  console.log('[ORDER] Vendor groups:', Object.keys(vendorGroups));

  for (const [vendorId, vItems] of Object.entries(vendorGroups)) {
    const resolvedVendorId = vendorId === 'unknown' ? null : vendorId;
    const vendorTotal = vItems.reduce((s, i) => s + (Number(i.price || i.selling_price) * Number(i.qty || 1)), 0);
    const itemNames   = vItems.map(i => `${i.name} x${i.qty || 1}`).join(', ');

    console.log(`[ORDER] Inserting order for vendor: ${resolvedVendorId}, items: ${itemNames}, total: ${vendorTotal}`);

    await pool.query(
      `INSERT INTO orders
        (vendor_id, product_name, quantity, total_amount, customer_name, customer_phone,
         status, order_type, delivery_address, client_id, client_name, client_phone,
         items, final_total, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'Pending','Online',$7,$8,$9,$10,$11,$12,NOW())`,
      [
        resolvedVendorId,
        itemNames,
        vItems.reduce((s, i) => s + Number(i.qty || 1), 0),
        vendorTotal,
        name,
        phone,
        delivery_address || null,
        req.user.userId,
        name,
        phone,
        JSON.stringify(vItems),
        vendorTotal,
      ]
    );
  }

  return ok(res, { bookingId: booking.id, status: 'Pending' }, 'Order placed successfully', 201);
});

// ── GET /api/orders/my ───────────────────────────────────────
const getMyOrders = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user.userId]
  );
  return ok(res, rows);
});

// ── GET /api/orders/:id ──────────────────────────────────────
const getOrderById = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM bookings WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.userId]
  );
  if (!rows.length) return err(res, 'Order not found', 404);
  return ok(res, rows[0]);
});

module.exports = { createOrder, getMyOrders, getOrderById };