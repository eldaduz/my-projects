const PEXELS_URL = 'https://api.pexels.com/v1/search';
const WIKIPEDIA_SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const DEFAULT_TIMEOUT_MS = 5000;

async function withTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromPexels(query, { apiKey, fetchImpl, timeoutMs }) {
  if (!apiKey) return null;
  try {
    const url = `${PEXELS_URL}?query=${encodeURIComponent(query)}&per_page=1`;
    const response = await withTimeout(fetchImpl, url, { headers: { Authorization: apiKey } }, timeoutMs);
    if (!response.ok) return null;
    const data = await response.json();
    const photo = data.photos?.[0];
    if (!photo) return null;
    return { url: photo.src.large, attribution: `Photo by ${photo.photographer} on Pexels`, source: 'pexels' };
  } catch {
    return null;
  }
}

async function fetchFromWikipedia(query, { fetchImpl, timeoutMs }) {
  try {
    // ponytail: title = destination string verbatim (works for well-known
    // places like "Paris"/"Tokyo"); no search-then-resolve step. Upgrade
    // path if coverage turns out too thin: call the MediaWiki search API
    // first to resolve the best matching title before fetching the summary.
    const url = `${WIKIPEDIA_SUMMARY_URL}/${encodeURIComponent(query)}`;
    const response = await withTimeout(fetchImpl, url, {}, timeoutMs);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.thumbnail?.source) return null;
    return { url: data.thumbnail.source, attribution: 'Wikipedia', source: 'wikipedia' };
  } catch {
    return null;
  }
}

export function createPhotoAdapter({ apiKey, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  return {
    async getPhoto(query) {
      const trimmed = query?.trim();
      if (!trimmed) return null;

      const pexelsPhoto = await fetchFromPexels(trimmed, { apiKey, fetchImpl, timeoutMs });
      if (pexelsPhoto) return pexelsPhoto;

      return fetchFromWikipedia(trimmed, { fetchImpl, timeoutMs });
    },
  };
}
