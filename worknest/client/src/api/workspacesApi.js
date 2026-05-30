import { apiRequest } from './apiClient.js';

export function getWorkspacesByBranch(branchId, filters = {}) {
  const searchParams = new URLSearchParams();

  if (filters.type) {
    searchParams.set('type', filters.type);
  }

  if (filters.minCapacity) {
    searchParams.set('minCapacity', filters.minCapacity);
  }

  const queryString = searchParams.toString();
  const endpoint = queryString
    ? `/branches/${branchId}/workspaces?${queryString}`
    : `/branches/${branchId}/workspaces`;

  return apiRequest(endpoint);
}

export function getWorkspaceById(workspaceId) {
  return apiRequest(`/workspaces/${workspaceId}`);
}

export function getAvailableWorkspaces(filters = {}) {
  const searchParams = new URLSearchParams();

  if (filters.startDate) {
    searchParams.set('startDate', filters.startDate);
  }

  if (filters.endDate) {
    searchParams.set('endDate', filters.endDate);
  }

  if (filters.branchId) {
    searchParams.set('branchId', filters.branchId);
  }

  if (filters.type) {
    searchParams.set('type', filters.type);
  }

  if (filters.minCapacity) {
    searchParams.set('minCapacity', filters.minCapacity);
  }

  const queryString = searchParams.toString();
  const endpoint = queryString ? `/workspaces/available?${queryString}` : '/workspaces/available';

  return apiRequest(endpoint);
}
