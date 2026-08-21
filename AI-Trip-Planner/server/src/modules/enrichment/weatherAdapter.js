const DEFAULT_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_TIMEOUT_MS = 5000;

export function createWeatherAdapter({
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
} = {}) {
  return {
    async getForecast({ lat, lon, startDate, endDate }) {
      if (lat == null || lon == null || !startDate || !endDate) return [];

      const url =
        `${baseUrl}?latitude=${lat}&longitude=${lon}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
        `&timezone=auto&start_date=${startDate}&end_date=${endDate}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) return [];
        const data = await response.json();
        const daily = data.daily;
        if (!daily?.time) return [];

        return daily.time.map((date, index) => ({
          date,
          tempMaxC: daily.temperature_2m_max[index],
          tempMinC: daily.temperature_2m_min[index],
          precipitationChance: daily.precipitation_probability_max[index],
          weatherCode: daily.weathercode[index],
        }));
      } catch {
        // Open-Meteo's free forecast only covers ~16 days ahead — trips
        // outside that window (or any transport failure) just get no
        // weather, per ATP-89's graceful-degradation requirement.
        return [];
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
