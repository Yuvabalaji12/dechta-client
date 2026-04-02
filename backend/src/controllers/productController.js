'use strict';

const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ok, err } = require('../utils/response');

// ─────────────────────────────────────────────────────────────
// Helper: map DB row → clean product object for frontend
// Matches exactly what App.jsx / ProductPage.jsx / HomePage.jsx expect:
//   product.id, product.name, product.selling_price, product.mrp,
//   product.images (array), product.category, product.description,
//   product.stock_quantity, product.unit, product.vendor_id,
//   product.vendorName, product.shop_name, product.location
// ─────────────────────────────────────────────────────────────
function mapProduct(p) {
  const images = Array.isArray(p.images)
    ? p.images
    : p.images
      ? Object.values(p.images)
      : [];

  // console.log("Product mapped data:", p); // DEBUG — remove later

  return {
    id:             p.id,
    name:           p.name,
    brand:          p.brand             || null,
    description:    p.description       || '',       // short description (30 words)
    detailed_description: p.detailed_description || null, // long description
    product_quality: p.product_quality  || null,
    warranty:        p.warranty         || null,
    category:       p.category || 'hardware',
    mrp:            p.mrp           ? Number(p.mrp)           : null,
    selling_price:  p.selling_price ? Number(p.selling_price) : null,
    price:          p.selling_price ? Number(p.selling_price) : null, // alias
    stock_quantity: p.stock_quantity ? Number(p.stock_quantity) : 0,
    unit:           p.unit || 'pcs',
    images,
    img:            images[0] || null,
    is_bulk:        p.is_bulk || false,
    is_boosted:     p.is_boosted || false,
    gst_percent:    p.gst_percent ? Number(p.gst_percent) : 18,
    rating:         p.rating ? Number(p.rating) : 5,
    // Vendor info
    vendor_id:      p.vendor_id,
    vendorName:     p.owner_name  || null,
    shop_name:      p.shop_name   || null,
    vendor_location: p.location   || null,
    vendor_area:    p.area        || null,
    vendor_lat:     p.latitude    ? Number(p.latitude)  : null,
    vendor_lng:     p.longitude   ? Number(p.longitude) : null,
    // Dimensions for delivery calc
    length_cm:      p.length_cm,
    width_cm:       p.width_cm,
    height_cm:      p.height_cm,
    weight_kg:      p.weight_kg,
    predicted_vehicle_type: p.predicted_vehicle_type || null,
    created_at:     p.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// Haversine distance in km
// ─────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────
// Base query: joins products → vendors
// RULE: ONLY status = 'approved' products are ever returned
// ─────────────────────────────────────────────────────────────
const BASE_SELECT = `
  SELECT
    p.*,
    v.owner_name,
    v.shop_name,
    v.location,
    v.area,
    v.shop_address,
    v.self_delivery
  FROM products p
  LEFT JOIN vendors v ON v.id = p.vendor_id
  WHERE p.is_active = true
    AND p.status = 'approved'
`;

// ─────────────────────────────────────────────────────────────
// GET /api/products
// ─────────────────────────────────────────────────────────────
const getProducts = asyncHandler(async (req, res) => {
  const { category, search, page = 1, limit = 50 } = req.query;

  let query  = BASE_SELECT;
  const vals = [];
  let idx    = 1;

  if (category && category !== 'all') {
    query += ` AND LOWER(p.category) = LOWER($${idx++})`;
    vals.push(category);
  }

  if (search) {
    query += ` AND (p.name ILIKE $${idx} OR p.description ILIKE $${idx} OR p.brand ILIKE $${idx})`;
    vals.push(`%${search}%`);
    idx++;
  }

  // Boosted products first, then newest
  query += ` ORDER BY p.is_boosted DESC, p.created_at DESC`;

  // Pagination
  const offset = (Number(page) - 1) * Number(limit);
  query += ` LIMIT $${idx++} OFFSET $${idx++}`;
  vals.push(Number(limit), offset);

  let { rows } = await pool.query(query, vals);

  // ── SAMPLE MODE ──────────────────────────────────────────────
  // REMOVE SAMPLE MODE AFTER ADMIN MODULE READY
  if (rows.length === 0) {
    const sample = await pool.query(
      `SELECT p.*, v.owner_name, v.shop_name, v.location, v.area, v.shop_address, v.self_delivery
       FROM products p
       LEFT JOIN vendors v ON v.id = p.vendor_id
       ORDER BY p.created_at DESC
       LIMIT 50`
    );
    rows = sample.rows;
    console.log('[SAMPLE MODE] Returning ALL products from DB for testing. Count:', rows.length);
  }
  // ── END SAMPLE MODE ──────────────────────────────────────────

  return ok(res, rows.map(mapProduct));
});

// ─────────────────────────────────────────────────────────────
// GET /api/products/nearby?lat=&lng=&radius=20
// ─────────────────────────────────────────────────────────────
const getNearbyProducts = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 20 } = req.query;

  if (!lat || !lng)
    return err(res, 'lat and lng query params are required', 400);

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const maxKm   = parseFloat(radius);

  if (isNaN(userLat) || isNaN(userLng))
    return err(res, 'Invalid coordinates', 400);

  // Fetch all approved products with vendor location
  const { rows } = await pool.query(
    `${BASE_SELECT}
     AND v.id IS NOT NULL
     ORDER BY p.is_boosted DESC, p.created_at DESC
     LIMIT 200`
  );

  // Filter by distance using Haversine
  // NOTE: vendors table stores location as TEXT (city/area name), not lat/lng.
  // We approximate distance using a bounding box on known coordinates.
  // When vendor lat/lng columns are added, replace this logic.
  const nearby = rows
    .map((p) => {
      // Use vendor lat/lng if available in DB, else treat all as nearby
      const vLat = p.latitude  ? Number(p.latitude)  : userLat;
      const vLng = p.longitude ? Number(p.longitude) : userLng;
      const dist = haversine(userLat, userLng, vLat, vLng);
      return { ...p, distanceKm: parseFloat(dist.toFixed(1)) };
    })
    .filter((p) => p.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // ── SAMPLE MODE ──────────────────────────────────────────────
  // REMOVE SAMPLE MODE AFTER ADMIN MODULE READY
  const result = nearby.length > 0 ? nearby : rows.slice(0, 20).map(p => ({ ...p, distanceKm: 0 }));
  // ── END SAMPLE MODE ──────────────────────────────────────────

  return ok(res, result.map(mapProduct));
});

// ─────────────────────────────────────────────────────────────
// GET /api/products/:id
// ─────────────────────────────────────────────────────────────
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await pool.query(
    `${BASE_SELECT} AND p.id = $1`,
    [id]
  );

  if (!rows.length) {
    // ── SAMPLE MODE ────────────────────────────────────────────
    // REMOVE SAMPLE MODE AFTER ADMIN MODULE READY
    const sample = await pool.query(
      `SELECT p.*, v.owner_name, v.shop_name, v.location, v.area, v.shop_address, v.self_delivery
       FROM products p
       LEFT JOIN vendors v ON v.id = p.vendor_id
       WHERE p.id = $1 AND p.is_active = true`,
      [id]
    );
    if (!sample.rows.length)
      return err(res, 'Product not found', 404);
    console.log('[SAMPLE MODE] Returning unapproved product for testing.');
    return ok(res, mapProduct(sample.rows[0]));
    // ── END SAMPLE MODE ────────────────────────────────────────
  }

  return ok(res, mapProduct(rows[0]));
});

// ─────────────────────────────────────────────────────────────
// GET /api/products/categories
// Returns distinct categories for CategoryBar
// ─────────────────────────────────────────────────────────────
const getCategories = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT LOWER(category) AS category, COUNT(*) AS count
     FROM products
     WHERE is_active = true AND status = 'approved'
     GROUP BY LOWER(category)
     ORDER BY count DESC`
  );
  return ok(res, rows);
});

// ─────────────────────────────────────────────────────────────
// GET /api/vendors/active  (list of vendors with products)
// Used by HomePage to show vendor selector
// ─────────────────────────────────────────────────────────────
const getActiveVendors = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT v.id, v.shop_name, v.owner_name, v.location, v.area, v.is_active
     FROM vendors v
     INNER JOIN products p ON p.vendor_id = v.id
     WHERE v.is_active = true AND p.status = 'approved' AND p.is_active = true
     ORDER BY v.shop_name`
  );

  // ── SAMPLE MODE ──────────────────────────────────────────────
  // REMOVE SAMPLE MODE AFTER ADMIN MODULE READY
  if (rows.length === 0) {
    const sample = await pool.query(
      `SELECT DISTINCT v.id, v.shop_name, v.owner_name, v.location, v.area, v.is_active
       FROM vendors v
       INNER JOIN products p ON p.vendor_id = v.id
       WHERE v.is_active = true
       ORDER BY v.shop_name LIMIT 10`
    );
    return ok(res, sample.rows);
  }
  // ── END SAMPLE MODE ──────────────────────────────────────────

  return ok(res, rows);
});

// ─────────────────────────────────────────────────────────────
// GET /api/vendors/:vendorId/products
// Products for a specific vendor (for shop-view in HomePage)
// ─────────────────────────────────────────────────────────────
const getVendorProducts = asyncHandler(async (req, res) => {
  const { vendorId } = req.params;

  let { rows } = await pool.query(
    `${BASE_SELECT} AND p.vendor_id = $1
     ORDER BY p.is_boosted DESC, p.created_at DESC`,
    [vendorId]
  );

  // ── SAMPLE MODE ──────────────────────────────────────────────
  // REMOVE SAMPLE MODE AFTER ADMIN MODULE READY
  if (rows.length === 0) {
    const sample = await pool.query(
      `SELECT p.*, v.owner_name, v.shop_name, v.location, v.area, v.shop_address, v.self_delivery
       FROM products p
       LEFT JOIN vendors v ON v.id = p.vendor_id
       WHERE p.vendor_id = $1`,
      [vendorId]
    );
    rows = sample.rows;
    console.log('[SAMPLE MODE] Vendor products - returning all. Count:', rows.length);
  }
  // ── END SAMPLE MODE ──────────────────────────────────────────

  return ok(res, rows.map(mapProduct));
});

module.exports = {
  getProducts,
  getNearbyProducts,
  getProductById,
  getCategories,
  getActiveVendors,
  getVendorProducts,
};