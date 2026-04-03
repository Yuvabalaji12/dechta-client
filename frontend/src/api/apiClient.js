// src/api/apiClient.js
// ─────────────────────────────────────────────────────────────
// Dechta Client — API helper
// All backend calls go through here.
// Base URL is controlled by VITE_API_URL in .env
// ─────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function getToken() {
  return localStorage.getItem('dechta_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Request failed: ${res.status}`);
  }

  return data;
}

// ── Auth ─────────────────────────────────────────────────────
export const sendOtp = (phone) =>
  request('/api/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });

export const verifyOtp = (phone, otp, name) =>
  request('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp, name }),
  });

export const getProfile = () => request('/api/auth/profile');

export const updateProfile = (updates) =>
  request('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

// ── Google OAuth ─────────────────────────────────────────────
export const googleAuth = (idToken) =>
  request('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });

export const completeGoogleProfile = (phone, name) =>
  request('/api/auth/google/complete', {
    method: 'PUT',
    body: JSON.stringify({ phone, name }),
  });

// ── Location ─────────────────────────────────────────────────
export const searchLocations = (query) =>
  request(`/api/location/search?q=${encodeURIComponent(query)}`);

export const reverseGeocode = (lat, lng) =>
  request(`/api/location/reverse-geocode?lat=${lat}&lng=${lng}`);

export const getMapsKey = () =>
  request('/api/location/maps-key');

// ── Products ─────────────────────────────────────────────────
export const fetchProducts = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/products${qs ? `?${qs}` : ''}`);
};

export const fetchProductById = (id) => request(`/api/products/${id}`);

export const fetchNearbyProducts = (lat, lng, radius = 20) =>
  request(`/api/products/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);

export const fetchCategories = () => request('/api/products/categories');

// ── Vendors ──────────────────────────────────────────────────
export const fetchActiveVendors = () => request('/api/vendors/active');

export const fetchVendorProducts = (vendorId) =>
  request(`/api/vendors/${vendorId}/products`);

// ── Orders ───────────────────────────────────────────────────
export const placeOrder = (orderData) =>
  request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });

export const fetchMyOrders = () => request('/api/orders/my');

// ── Health ───────────────────────────────────────────────────
export const checkHealth = () => request('/api/health');
