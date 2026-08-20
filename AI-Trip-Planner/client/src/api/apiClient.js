const API_BASE_URL = '/api'

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message || DEFAULT_ERROR_MESSAGE)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function parseBody(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null

  try {
    return await response.json()
  } catch {
    return null
  }
}

async function request(path, { method = 'GET', body, headers, signal } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    // A caller-initiated abort (e.g. effect cleanup) is not a connectivity
    // failure, so callers can tell it apart from a real network error.
    if (err.name === 'AbortError') {
      throw new ApiError('Request was cancelled.', { status: 0, code: 'ABORT_ERROR' })
    }

    // Network failure, CORS, etc. Never leak the raw error.
    throw new ApiError('Unable to reach the server. Check your connection and try again.', {
      status: 0,
      code: 'NETWORK_ERROR',
    })
  }

  const data = await parseBody(response)

  if (!response.ok) {
    throw new ApiError(data?.error?.message || DEFAULT_ERROR_MESSAGE, {
      status: response.status,
      code: data?.error?.code,
    })
  }

  return data
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}
