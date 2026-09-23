import { describe, test, expect, vi } from 'vitest'
import { errorHandler, HttpError } from '../../src/middleware/errorHandler.js'

function mockRes() {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('errorHandler', () => {
  test('passes through the message for a 4xx HttpError', () => {
    const res = mockRes()
    const err = new HttpError(404, 'Trip not found', 'NOT_FOUND')

    errorHandler(err, {}, res, () => {})

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Trip not found', code: 'NOT_FOUND' },
    })
  })

  test('never leaks the internal message for a 5xx, even with an explicit status', () => {
    const res = mockRes()
    const err = new HttpError(500, 'connection string user:pass@cluster failed')

    errorHandler(err, {}, res, () => {})

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Something went wrong. Please try again.', code: undefined },
    })
  })

  test('defaults an unmarked error to a safe 500', () => {
    const res = mockRes()

    errorHandler(new Error('some internal failure'), {}, res, () => {})

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Something went wrong. Please try again.', code: undefined },
    })
  })
})
