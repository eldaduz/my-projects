import { describe, test, expect, vi } from 'vitest';
import { createPhotoAdapter } from '../../src/modules/enrichment/photoAdapter.js';

const PEXELS_HIT = {
  ok: true,
  json: async () => ({
    photos: [{ src: { large: 'https://images.pexels.com/photo.jpg' }, photographer: 'Jane Doe', url: 'https://pexels.com/photo/1' }],
  }),
};
const PEXELS_MISS = { ok: true, json: async () => ({ photos: [] }) };
const WIKI_HIT = {
  ok: true,
  json: async () => ({ thumbnail: { source: 'https://wiki.example/thumb.jpg' }, title: 'Paris' }),
};

describe('photoAdapter', () => {
  test('returns a Pexels photo when Pexels has a result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(PEXELS_HIT);
    const adapter = createPhotoAdapter({ apiKey: 'test-key', fetchImpl });

    const photo = await adapter.getPhoto('Paris');

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('query=Paris'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'test-key' }) }),
    );
    expect(photo).toEqual({ url: 'https://images.pexels.com/photo.jpg', attribution: 'Photo by Jane Doe on Pexels', source: 'pexels' });
  });

  test('falls back to Wikipedia when Pexels has no result', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(PEXELS_MISS).mockResolvedValueOnce(WIKI_HIT);
    const adapter = createPhotoAdapter({ apiKey: 'test-key', fetchImpl });

    const photo = await adapter.getPhoto('Paris');

    expect(photo).toEqual({ url: 'https://wiki.example/thumb.jpg', attribution: 'Wikipedia', source: 'wikipedia' });
  });

  test('skips Pexels entirely when no apiKey is configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(WIKI_HIT);
    const adapter = createPhotoAdapter({ apiKey: undefined, fetchImpl });

    const photo = await adapter.getPhoto('Paris');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(photo.source).toBe('wikipedia');
  });

  test('returns null when both Pexels and Wikipedia have nothing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
    const adapter = createPhotoAdapter({ apiKey: 'test-key', fetchImpl });

    expect(await adapter.getPhoto('Nowhereville')).toBeNull();
  });

  test('returns null on network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('down'));
    const adapter = createPhotoAdapter({ apiKey: 'test-key', fetchImpl });

    expect(await adapter.getPhoto('Paris')).toBeNull();
  });
});
