import { apiRequest } from './apiClient.js';

export function createReservation(reservationData, token) {
  return apiRequest('/reservations', {
    method: 'POST',
    body: reservationData,
    token,
  });
}

export function getMyReservations(token, status) {
  const searchParams = new URLSearchParams();

  if (status) {
    searchParams.set('status', status);
  }

  const queryString = searchParams.toString();
  const endpoint = queryString ? `/reservations/my?${queryString}` : '/reservations/my';

  return apiRequest(endpoint, {
    token,
  });
}

export function getReservationById(reservationId, token) {
  return apiRequest(`/reservations/${reservationId}`, {
    token,
  });
}

export function cancelReservation(reservationId, token) {
  return apiRequest(`/reservations/${reservationId}/cancel`, {
    method: 'PATCH',
    token,
  });
}
