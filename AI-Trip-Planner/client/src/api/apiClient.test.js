import { describe, test, expect, vi, afterEach } from 'vitest'
import { apiClient, ApiError } from './apiClient'

function mockFetchOnce({ ok, status, body }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      headers: { get: () => 'application/json' },
      json: async () => body,
    }),
  )
}

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('returns parsed JSON on a successful response', async () => {
    mockFetchOnce({ ok: true, status: 200, body: { data: 'ok' } })

    const result = await apiClient.get('/health')

    expect(result).toEqual({ data: 'ok' })
  })

  test('sends credentials and a JSON body on POST', async () => {
    mockFetchOnce({ ok: true, status: 201, body: { data: 'created' } })

    await apiClient.post('/trips', { destination: 'Lisbon' })

    expect(fetch).toHaveBeenCalledWith(
      '/api/trips',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ destination: 'Lisbon' }),
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  test('throws a normalized ApiError on a non-ok response', async () => {
    mockFetchOnce({
      ok: false,
      status: 404,
      body: { error: { message: 'Trip not found', code: 'NOT_FOUND' } },
    })

    await expect(apiClient.get('/trips/missing')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Trip not found',
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  test('throws a safe ApiError when the network request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('network down')),
    )

    await expect(apiClient.get('/health')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })

  test('distinguishes a caller-initiated abort from a network error', async () => {
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))

    await expect(apiClient.get('/health')).rejects.toMatchObject({
      code: 'ABORT_ERROR',
    })
  })
})
