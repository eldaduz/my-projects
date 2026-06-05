// API base URL from Vite env, with a localhost fallback for development.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3005/api';

// Single HTTP abstraction for every API call.
// Handles: method, JSON body, optional Bearer token, and error normalization.
export async function apiRequest(endpoint, options = {}) {
  const { method = 'GET', body, token } = options;

  const headers = {
    Accept: 'application/json',
  };

  // Some requests are public, so the token must stay optional here.
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // The backend always returns JSON, even for errors.
  // We convert non-OK responses into thrown Error objects with the server's message.
  const responseData = await response.json();

  if (!response.ok) {
    const error = new Error(responseData.message || 'Request failed');
    error.status = response.status;
    error.data = responseData;
    throw error;
  }

  return responseData;
}
