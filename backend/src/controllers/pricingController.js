'use strict';

const pool         = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { ok, err }  = require('../utils/response');

// ─────────────────────────────────────────────────────────────
// Haversine distance in km (used when Google Maps key unavailable)
// ─────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────
// Google Distance Matrix API (returns km between two points)
// Falls back to haversine if API key is missing / request fails
// ─────────────────────────────────────────────────────────────
async function getDistanceKm(originLat, originLng, destLat, destLng) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (apiKey && apiKey !== 'your_google_maps_api_key_here') {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/distancematrix/json` +
        `?origins=${originLat},${originLng}` +
        `&destinations=${destLat},${destLng}` +
        `&mode=driving` +
        `&key=${apiKey}`;

      const response = await fetch(url);
      const data     = await response.json();

      const element = data?.rows?.[0]?.elements?.[0];
      if (element?.status === 'OK' && element.distance?.value) {
        // distance.value is in metres
        return parseFloat((element.distance.value / 1000).toFixed(2));
      }
    } catch (e) {
      console.warn('[PRICING] Google Distance Matrix failed, using haversine fallback:', e.message);
    }
  }

  // Fallback to haversine formula
  return parseFloat(haversineKm(originLat, originLng, destLat, destLng).toFixed(2));
}

// ─────────────────────────────────────────────────────────────
// GET /api/pricing/delivery
// Query params: vehicle_type, origin_lat, origin_lng, dest_lat, dest_lng
// Returns: { delivery_charge, distance_km, vehicle_type, base_fare, rate_per_km }
// ─────────────────────────────────────────────────────────────
const getDeliveryCharge = asyncHandler(async (req, res) => {
  const { vehicle_type, origin_lat, origin_lng, dest_lat, dest_lng } = req.query;

  // ── Validate inputs ──────────────────────────────────────────
  if (!vehicle_type) return err(res, 'vehicle_type is required', 400);
  if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
    return err(res, 'origin_lat, origin_lng, dest_lat, dest_lng are all required', 400);
  }

  const oLat = parseFloat(origin_lat);
  const oLng = parseFloat(origin_lng);
  const dLat = parseFloat(dest_lat);
  const dLng = parseFloat(dest_lng);

  if ([oLat, oLng, dLat, dLng].some(isNaN)) {
    return err(res, 'Coordinates must be valid numbers', 400);
  }

  // ── Fetch pricing from DB ────────────────────────────────────
  const { rows } = await pool.query(
    `SELECT base_fare, rate_per_km, min_km, display_name
     FROM public.vehicle_pricing
     WHERE vehicle_type = $1 AND is_active = true
     LIMIT 1`,
    [vehicle_type.toLowerCase()]
  );

  if (!rows.length) return err(res, `No pricing found for vehicle type: ${vehicle_type}`, 404);

  const { base_fare, rate_per_km, min_km, display_name } = rows[0];

  // ── Compute distance ─────────────────────────────────────────
  const rawDistanceKm = await getDistanceKm(oLat, oLng, dLat, dLng);
  const distance_km   = Math.max(rawDistanceKm, Number(min_km));  // apply min_km rule

  // ── Apply formula: base_fare + (rate_per_km × distance_km) ─
  const delivery_charge = parseFloat(
    (Number(base_fare) + Number(rate_per_km) * distance_km).toFixed(2)
  );

  return ok(res, {
    vehicle_type,
    display_name,
    distance_km,
    base_fare:      Number(base_fare),
    rate_per_km:    Number(rate_per_km),
    min_km:         Number(min_km),
    delivery_charge,
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/pricing/vehicles
// Returns all active vehicle types and their base pricing
// (used by CheckoutModal to render the vehicle selector)
// ─────────────────────────────────────────────────────────────
const getVehiclePricing = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT vehicle_type, display_name, base_fare, rate_per_km, min_km
     FROM public.vehicle_pricing
     WHERE is_active = true
     ORDER BY base_fare ASC`
  );
  return ok(res, rows);
});

module.exports = { getDeliveryCharge, getVehiclePricing };
