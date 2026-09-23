// ╔══════════════════════════════════════════════════════════════════╗
// ║ API CLIENT — Centralized HTTP wrapper for all server calls       ║
// ║                                                                  ║
// ║ REUSE: This is used by EVERY page and component that talks to   ║
// ║ the server: AuthContext, LoginPage, RegisterPage, TripsPage,    ║
// ║ TripWizardPage, TravelerProfilesPage, DestinationAutocomplete,  ║
// ║ DestinationPhoto, TripWeather, ItineraryView.                   ║
// ║                                                                  ║
// ║ PATTERN: Wrapper/Facade — hides fetch() complexity behind a     ║
// ║ simple interface: apiClient.get(), .post(), .patch(), .delete() ║
// ║                                                                  ║
// ║ WHY NOT USE FETCH DIRECTLY? Because:                             ║
// ║   1. credentials: 'include' (cookies) must be set every time    ║
// ║   2. JSON headers must be set for POST/PATCH                     ║
// ║   3. Error parsing (extracting error.message from response body) ║
// ║   4. AbortError handling (cleanup on unmount)                    ║
// ║ Without this wrapper, ALL of that would be duplicated in 10+     ║
// ║ files. DRY principle.                                            ║
// ╚══════════════════════════════════════════════════════════════════╝
const API_BASE_URL = '/api'

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.'

// STUDY NOTE: Custom Error class for API errors.
// TEACHER Q: "Why a custom class instead of just new Error()?" → Because
// we need to carry `status` (HTTP code) and `code` (machine-readable string
// like 'NETWORK_ERROR') alongside the message. Components use these to
// show different UI for different error types.
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
      // STUDY NOTE: credentials: 'include' tells the browser to send cookies
      // with the request. Without this, our httpOnly JWT cookie won't be sent
      // and every protected route would return 401 Unauthorized.
      credentials: 'include',
      headers: {
        // STUDY NOTE: Only set Content-Type for requests with a body
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // STUDY NOTE: signal allows the caller to cancel in-flight requests.
      // Used with AbortController in React useEffect cleanup to prevent
      // updating state on unmounted components.
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
