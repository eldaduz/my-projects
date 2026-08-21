// server/src/modules/enrichment/enrichment.routes.js
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { enrichmentRateLimiter, photoRateLimiter } from '../../middleware/enrichmentRateLimiter.js';
import { createEnrichmentControllers } from './enrichment.controller.js';

export function createEnrichmentRouter({ placesAdapter, weatherAdapter, photoAdapter }) {
  const router = Router();
  const { autocomplete, weather, photo } = createEnrichmentControllers({ placesAdapter, weatherAdapter, photoAdapter });

  router.use(requireAuth);
  router.use(enrichmentRateLimiter);

  router.get('/autocomplete', autocomplete);
  router.get('/weather', weather);
  // Photo specifically also gets the stricter, Pexels-budget-scoped limiter.
  router.get('/photo', photoRateLimiter, photo);

  return router;
}
