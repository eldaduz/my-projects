import { apiRequest } from './apiClient.js';

export function getBranches(filters = {}) {
  const searchParams = new URLSearchParams();

  if (filters.search) {
    searchParams.set('search', filters.search);
  }

  if (filters.city) {
    searchParams.set('city', filters.city);
  }

  if (filters.rating) {
    searchParams.set('rating', filters.rating);
  }

  const queryString = searchParams.toString();
  const endpoint = queryString ? `/branches?${queryString}` : '/branches';

  return apiRequest(endpoint);
}

export function getBranchById(branchId) {
  return apiRequest(`/branches/${branchId}`);
}
