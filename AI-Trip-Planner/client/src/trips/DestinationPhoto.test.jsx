import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DestinationPhoto } from './DestinationPhoto';
import { apiClient } from '../api/apiClient';

vi.mock('../api/apiClient', () => ({ apiClient: { get: vi.fn() } }));

describe('DestinationPhoto', () => {
  afterEach(() => vi.clearAllMocks());

  test('renders the photo and attribution when available', async () => {
    apiClient.get.mockResolvedValue({ available: true, url: 'https://img.example/paris.jpg', attribution: 'Photo by Jane Doe on Pexels', source: 'pexels' });

    render(<DestinationPhoto destination="Paris" />);

    const img = await screen.findByRole('img', { name: 'Paris' });
    expect(img).toHaveAttribute('src', 'https://img.example/paris.jpg');
    expect(screen.getByText('Photo by Jane Doe on Pexels')).toBeInTheDocument();
  });

  test('renders nothing and skips the fetch when there is no destination', () => {
    const { container } = render(<DestinationPhoto destination="" />);

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when unavailable', async () => {
    apiClient.get.mockResolvedValue({ available: false });
    const { container } = render(<DestinationPhoto destination="Nowhereville" />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when the request fails', async () => {
    apiClient.get.mockRejectedValue(new Error('down'));
    const { container } = render(<DestinationPhoto destination="Berlin" />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  test('reuses a cached photo without refetching', async () => {
    apiClient.get.mockResolvedValue({ available: true, url: 'https://img.example/rome.jpg', attribution: 'Photo of Rome', source: 'pexels' });
    render(<DestinationPhoto destination="Rome" />);
    await screen.findByRole('img', { name: 'Rome' });
    expect(apiClient.get).toHaveBeenCalledTimes(1);

    render(<DestinationPhoto destination="Rome" />);
    const [, secondImg] = await screen.findAllByRole('img', { name: 'Rome' });
    expect(secondImg).toHaveAttribute('src', 'https://img.example/rome.jpg');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  test('renders as a decorative, unlabeled thumbnail when in thumbnail mode', async () => {
    apiClient.get.mockResolvedValue({ available: true, url: 'https://img.example/oslo.jpg', attribution: 'Photo of Oslo', source: 'pexels' });
    const { container } = render(<DestinationPhoto destination="Oslo" thumbnail />);

    await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument());
    expect(container.querySelector('figure')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(container.querySelector('figcaption')).not.toBeInTheDocument();
  });
});
