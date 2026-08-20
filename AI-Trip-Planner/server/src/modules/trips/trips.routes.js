import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { loadOwnedResource } from '../../middleware/loadOwnedResource.js';
import { aiRateLimiter, aiRateLimiterByIp } from '../../middleware/aiRateLimiter.js';
import { aiConcurrencyGuard } from '../../middleware/aiConcurrencyGuard.js';
import { staleAiOperationRecovery } from './staleAiOperationRecovery.js';
import { Trip } from './trip.model.js';
import {
  createTrip,
  listTrips,
  getTrip,
  updateTrip,
  deleteTrip,
  editItinerary,
  createGenerateItineraryHandler,
  createReplanItineraryHandler,
} from './trips.controller.js';

// AI generation/replan (F13/F17) routes nest here under /api/trips/:id/... in
// later Features; they are not separate top-level resources.
export function createTripsRouter({ geminiAdapter } = {}) {
  const router = Router();
  const loadOwnedTrip = loadOwnedResource(Trip, { resourceKey: 'trip' });

  router.use(requireAuth);

  router.post('/', createTrip);
  router.get('/', listTrips);
  router.get('/:id', loadOwnedTrip, staleAiOperationRecovery, getTrip);
  router.patch('/:id', loadOwnedTrip, staleAiOperationRecovery, updateTrip);
  router.delete('/:id', loadOwnedTrip, staleAiOperationRecovery, deleteTrip);
  router.patch('/:id/itinerary', loadOwnedTrip, staleAiOperationRecovery, editItinerary);
  router.post(
    '/:id/generate-itinerary',
    loadOwnedTrip,
    staleAiOperationRecovery,
    // Per-user first: a request already over its own quota must never reach
    // (and consume) the shared per-IP bucket, or repeated over-quota retries
    // from one user can starve other users behind the same IP/NAT.
    aiRateLimiter,
    aiRateLimiterByIp,
    aiConcurrencyGuard,
    createGenerateItineraryHandler({ geminiAdapter }),
  );
  router.post(
    '/:id/replan-itinerary',
    loadOwnedTrip,
    staleAiOperationRecovery,
    aiRateLimiter,
    aiRateLimiterByIp,
    aiConcurrencyGuard,
    createReplanItineraryHandler({ geminiAdapter }),
  );

  return router;
}
