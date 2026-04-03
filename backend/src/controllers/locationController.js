'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok, err }  = require('../utils/response');

const GOOGLE_MAPS_KEY = () => process.env.GOOGLE_MAPS_API_KEY;

// ── GET /api/location/search?q=... ──────────────────────────
// Proxies Google Places Autocomplete — keeps API key server-side
const searchLocation = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return err(res, 'Query parameter "q" is required', 400);

  const apiKey = GOOGLE_MAPS_KEY();
  if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
    // ── Fallback: return mock results when no API key ─────────
    console.warn('[Location] No GOOGLE_MAPS_API_KEY set — returning mock results');
    return ok(res, [
      { place_id: 'mock_1', title: `${q} - Area 1`, subtitle: 'Mock locality, City, State' },
      { place_id: 'mock_2', title: `${q} - Area 2`, subtitle: 'Mock locality, City, State' },
    ], 'Mock results (no API key)');
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', q);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('components', 'country:in'); // restrict to India
    url.searchParams.set('types', 'geocode');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Location] Places API error:', data.status, data.error_message);
      return err(res, `Places API error: ${data.status}`, 502);
    }

    const results = (data.predictions || []).map(p => ({
      place_id: p.place_id,
      title: p.structured_formatting?.main_text || p.description,
      subtitle: p.structured_formatting?.secondary_text || '',
    }));

    return ok(res, results);
  } catch (e) {
    console.error('[Location] Search failed:', e.message);
    return err(res, 'Location search failed', 500);
  }
});

// ── GET /api/location/reverse-geocode?lat=...&lng=... ───────
// Proxies Google Geocoding reverse — keeps API key server-side
const reverseGeocode = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return err(res, 'lat and lng query params are required', 400);

  const apiKey = GOOGLE_MAPS_KEY();
  if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
    console.warn('[Location] No GOOGLE_MAPS_API_KEY set — returning mock geocode');
    return ok(res, {
      formatted: `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`,
      area: 'Mock Area',
      city: 'Mock City',
      state: 'Mock State',
      zip: '600001',
    }, 'Mock geocode (no API key)');
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'en');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('[Location] Geocode API error:', data.status, data.error_message);
      return err(res, `Geocode API error: ${data.status}`, 502);
    }

    const result = data.results?.[0];
    if (!result) return err(res, 'No geocode results', 404);

    // Extract address components
    const get = (type) =>
      result.address_components?.find(c => c.types.includes(type))?.long_name || '';

    return ok(res, {
      formatted: result.formatted_address || '',
      area: get('sublocality_level_1') || get('sublocality') || get('neighborhood') || get('locality'),
      city: get('locality') || get('administrative_area_level_2'),
      state: get('administrative_area_level_1'),
      zip: get('postal_code'),
    });
  } catch (e) {
    console.error('[Location] Reverse geocode failed:', e.message);
    return err(res, 'Reverse geocode failed', 500);
  }
});

// ── GET /api/location/maps-key ──────────────────────────────
// Returns the Maps API key to frontend for JS API loading
// (In production, restrict this key to frontend domain referers)
const getMapsKey = asyncHandler(async (req, res) => {
  const apiKey = GOOGLE_MAPS_KEY();
  if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
    return ok(res, { key: null }, 'No maps API key configured');
  }
  return ok(res, { key: apiKey });
});

module.exports = { searchLocation, reverseGeocode, getMapsKey };
