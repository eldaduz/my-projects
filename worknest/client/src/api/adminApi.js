import { apiRequest } from './apiClient.js';

export function createBranch(branchData, token) {
  return apiRequest('/branches', {
    method: 'POST',
    body: branchData,
    token,
  });
}

export function updateBranch(branchId, branchData, token) {
  return apiRequest(`/branches/${branchId}`, {
    method: 'PUT',
    body: branchData,
    token,
  });
}

export function createWorkspace(workspaceData, token) {
  return apiRequest('/workspaces', {
    method: 'POST',
    body: workspaceData,
    token,
  });
}

export function updateWorkspace(workspaceId, workspaceData, token) {
  return apiRequest(`/workspaces/${workspaceId}`, {
    method: 'PUT',
    body: workspaceData,
    token,
  });
}

export function getAllReservations(token, status) {
  const searchParams = new URLSearchParams();

  if (status) {
    searchParams.set('status', status);
  }

  const queryString = searchParams.toString();
  const endpoint = queryString ? `/reservations?${queryString}` : '/reservations';

  return apiRequest(endpoint, {
    token,
  });
}
