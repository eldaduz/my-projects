import { apiRequest } from './apiClient.js';

export function registerUser(userData) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: userData,
  });
}

export function loginUser(credentials) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export function getCurrentUser(token) {
  return apiRequest('/auth/me', {
    token,
  });
}
