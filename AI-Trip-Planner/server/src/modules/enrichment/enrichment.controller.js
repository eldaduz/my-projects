// server/src/modules/enrichment/enrichment.controller.js
import { HttpError } from '../../middleware/errorHandler.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createEnrichmentControllers({ placesAdapter, weatherAdapter, photoAdapter }) {
  async function autocomplete(req, res, next) {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q : '';
      const suggestions = await placesAdapter.autocomplete(query);
      res.json({ suggestions });
    } catch (err) {
      next(err);
    }
  }

  async function weather(req, res, next) {
    try {
      const { destination, startDate, endDate } = req.query;
      if (
        typeof destination !== 'string' ||
        !destination.trim() ||
        !DATE_PATTERN.test(startDate ?? '') ||
        !DATE_PATTERN.test(endDate ?? '')
      ) {
        throw new HttpError(400, 'destination, startDate, and endDate are required.', 'INVALID_QUERY');
      }

      const coords = await placesAdapter.geocode(destination);
      if (!coords) {
        res.json({ available: false });
        return;
      }

      const days = await weatherAdapter.getForecast({ lat: coords.lat, lon: coords.lon, startDate, endDate });
      res.json(days.length > 0 ? { available: true, days } : { available: false });
    } catch (err) {
      next(err);
    }
  }

  async function photo(req, res, next) {
    try {
      const { destination } = req.query;
      if (typeof destination !== 'string' || !destination.trim()) {
        throw new HttpError(400, 'destination is required.', 'INVALID_QUERY');
      }

      const result = await photoAdapter.getPhoto(destination);
      res.json(result ? { available: true, ...result } : { available: false });
    } catch (err) {
      next(err);
    }
  }

  return { autocomplete, weather, photo };
}
