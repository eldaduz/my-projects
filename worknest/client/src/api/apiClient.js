export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3005/api';

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

  // The backend returns JSON for both success and error cases.
  const responseData = await response.json();

  if (!response.ok) {
    const error = new Error(responseData.message || 'Request failed');
    error.status = response.status;
    error.data = responseData;
    throw error;
  }

  return responseData;
}
