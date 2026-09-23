import { describe, test, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'

describe('GET /api/health', () => {
  test('returns 200 and an ok status', async () => {
    const app = createApp()

    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('unmatched routes', () => {
  test('returns a normalized 404 for unmatched /api routes', async () => {
    const app = createApp()

    const res = await request(app).get('/api/does-not-exist')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: { message: 'Not found', code: 'NOT_FOUND' } })
  })

  test('returns a normalized JSON 404 for non-/api routes too', async () => {
    const app = createApp()

    const res = await request(app).get('/does-not-exist')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: { message: 'Not found', code: 'NOT_FOUND' } })
  })
})
