const DEFAULT_BASE_URL = 'https://photon.komoot.io/api/';
const DEFAULT_TIMEOUT_MS = 5000;

function featureLabel(properties) {
  return [properties.name, properties.city, properties.state, properties.country]
    .filter((part, index, all) => part && all.indexOf(part) === index)
    .join(', ');
}

// Returns null (never throws) for a feature missing valid coordinates, so a
// single malformed Photon result can't turn a best-effort lookup into a 500.
function featureToPlace(feature) {
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  const [lon, lat] = coordinates;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return { label: featureLabel(feature.properties ?? {}), lat, lon };
}

async function fetchFeatures({ query, limit, baseUrl, timeoutMs, fetchImpl }) {
  const trimmed = query?.trim();
  if (!trimmed) return [];

  const url = `${baseUrl}?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.features) ? data.features : [];
  } catch {
    // Network error, timeout, or malformed response — treated the same as
    // "no results" per ATP-89's graceful-degradation requirement.
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function createPlacesAdapter({
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
} = {}) {
  return {
    async autocomplete(query) {
      const features = await fetchFeatures({ query, limit: 5, baseUrl, timeoutMs, fetchImpl });
      return features.map(featureToPlace).filter((place) => place !== null);
    },
    async geocode(query) {
      const features = await fetchFeatures({ query, limit: 1, baseUrl, timeoutMs, fetchImpl });
      const place = features.length > 0 ? featureToPlace(features[0]) : null;
      return place ? { lat: place.lat, lon: place.lon } : null;
    },
  };
}
