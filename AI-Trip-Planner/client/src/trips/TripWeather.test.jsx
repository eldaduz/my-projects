import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TripWeather } from './TripWeather';
import { apiClient } from '../api/apiClient';

vi.mock('../api/apiClient', () => ({ apiClient: { get: vi.fn() } }));

describe('TripWeather', () => {
  afterEach(() => vi.clearAllMocks());

  test('renders forecast days when available', async () => {
    apiClient.get.mockResolvedValue({
      available: true,
      days: [{ date: '2026-09-01', tempMaxC: 24, tempMinC: 15, precipitationChance: 10, weatherCode: 1 }],
    });

    render(<TripWeather destination="Paris" startDate="2026-09-01" endDate="2026-09-01" />);

    expect(await screen.findByText(/24.*15/)).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/enrichment/weather?destination=Paris&startDate=2026-09-01&endDate=2026-09-01');
  });

  test('normalizes full ISO timestamp dates (as persisted trips carry them) to YYYY-MM-DD', async () => {
    apiClient.get.mockResolvedValue({ available: false });

    render(<TripWeather destination="Paris" startDate="2026-09-01T00:00:00.000Z" endDate="2026-09-03T00:00:00.000Z" />);

    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith('/enrichment/weather?destination=Paris&startDate=2026-09-01&endDate=2026-09-03'),
    );
  });

  test('renders nothing when unavailable', async () => {
    apiClient.get.mockResolvedValue({ available: false });
    const { container } = render(<TripWeather destination="Paris" startDate="2026-09-01" endDate="2026-09-01" />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when the request fails', async () => {
    apiClient.get.mockRejectedValue(new Error('down'));
    const { container } = render(<TripWeather destination="Paris" startDate="2026-09-01" endDate="2026-09-01" />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
