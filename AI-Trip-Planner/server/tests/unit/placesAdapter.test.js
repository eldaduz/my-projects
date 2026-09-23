import { describe, test, expect, vi } from 'vitest';
import { createPlacesAdapter } from '../../src/modules/enrichment/placesAdapter.js';

function photonResponse(features) {
  return { ok: true, json: async () => ({ features }) };
}

const SAMPLE_FEATURE = {
  properties: { name: 'Paris', city: 'Paris', country: 'France' },
  geometry: { coordinates: [2.3522, 48.8566] }, // [lon, lat]
};

describe('placesAdapter', () => {
  test('autocomplete returns label/lat/lon for each Photon feature', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(photonResponse([SAMPLE_FEATURE]));
    const adapter = createPlacesAdapter({ fetchImpl });

    const results = await adapter.autocomplete('Paris');

    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('q=Paris'), expect.any(Object));
    expect(results).toEqual([{ label: 'Paris, France', lat: 48.8566, lon: 2.3522 }]);
  });

  test('autocomplete returns empty array on network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const adapter = createPlacesAdapter({ fetchImpl });

    const results = await adapter.autocomplete('Paris');

    expect(results).toEqual([]);
  });

  test('autocomplete returns empty array for blank query without calling fetch', async () => {
    const fetchImpl = vi.fn();
    const adapter = createPlacesAdapter({ fetchImpl });

    const results = await adapter.autocomplete('  ');

    expect(results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('geocode returns the first result as {lat, lon}', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(photonResponse([SAMPLE_FEATURE]));
    const adapter = createPlacesAdapter({ fetchImpl });

    const result = await adapter.geocode('Paris');

    expect(result).toEqual({ lat: 48.8566, lon: 2.3522 });
  });

  test('geocode returns null when Photon has no features', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(photonResponse([]));
    const adapter = createPlacesAdapter({ fetchImpl });

    expect(await adapter.geocode('Nowhereville')).toBeNull();
  });

  test('geocode returns null on failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'));
    const adapter = createPlacesAdapter({ fetchImpl });

    expect(await adapter.geocode('Paris')).toBeNull();
  });

  test('autocomplete filters out malformed features (missing/invalid coordinates) instead of throwing', async () => {
    const malformedFeature = { properties: { name: 'Malformed result' } };
    const fetchImpl = vi.fn().mockResolvedValue(photonResponse([malformedFeature, SAMPLE_FEATURE]));
    const adapter = createPlacesAdapter({ fetchImpl });

    const results = await adapter.autocomplete('Paris');

    expect(results).toEqual([{ label: 'Paris, France', lat: 48.8566, lon: 2.3522 }]);
  });

  test('autocomplete deduplicates features that share the same label', async () => {
    const duplicateFeature = {
      properties: { name: 'Paris', city: 'Paris', country: 'France' },
      geometry: { coordinates: [2.36, 48.86] }, // different coords, same label
    };
    const fetchImpl = vi.fn().mockResolvedValue(photonResponse([SAMPLE_FEATURE, duplicateFeature]));
    const adapter = createPlacesAdapter({ fetchImpl });

    const results = await adapter.autocomplete('Paris');

    expect(results).toEqual([{ label: 'Paris, France', lat: 48.8566, lon: 2.3522 }]);
  });

  test('geocode returns null when the first result is malformed', async () => {
    const malformedFeature = { properties: { name: 'Malformed result' } };
    const fetchImpl = vi.fn().mockResolvedValue(photonResponse([malformedFeature]));
    const adapter = createPlacesAdapter({ fetchImpl });

    expect(await adapter.geocode('Paris')).toBeNull();
  });
});
