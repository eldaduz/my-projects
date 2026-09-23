import { describe, test, expect, vi } from 'vitest';
import { createWeatherAdapter } from '../../src/modules/enrichment/weatherAdapter.js';

const SAMPLE_DAILY = {
  time: ['2026-09-01', '2026-09-02'],
  temperature_2m_max: [24.1, 22.8],
  temperature_2m_min: [15.3, 14.9],
  precipitation_probability_max: [10, 40],
  weathercode: [1, 61],
};

describe('weatherAdapter', () => {
  test('getForecast maps Open-Meteo daily arrays into a day list', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ daily: SAMPLE_DAILY }) });
    const adapter = createWeatherAdapter({ fetchImpl });

    const days = await adapter.getForecast({ lat: 48.85, lon: 2.35, startDate: '2026-09-01', endDate: '2026-09-02' });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringMatching(/latitude=48\.85.*longitude=2\.35.*start_date=2026-09-01.*end_date=2026-09-02/),
      expect.any(Object),
    );
    expect(days).toEqual([
      { date: '2026-09-01', tempMaxC: 24.1, tempMinC: 15.3, precipitationChance: 10, weatherCode: 1 },
      { date: '2026-09-02', tempMaxC: 22.8, tempMinC: 14.9, precipitationChance: 40, weatherCode: 61 },
    ]);
  });

  test('getForecast returns empty array when lat/lon missing', async () => {
    const fetchImpl = vi.fn();
    const adapter = createWeatherAdapter({ fetchImpl });

    const days = await adapter.getForecast({ lat: null, lon: null, startDate: '2026-09-01', endDate: '2026-09-02' });

    expect(days).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('getForecast returns empty array on failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('timeout'));
    const adapter = createWeatherAdapter({ fetchImpl });

    const days = await adapter.getForecast({ lat: 48.85, lon: 2.35, startDate: '2026-09-01', endDate: '2026-09-02' });

    expect(days).toEqual([]);
  });
});
