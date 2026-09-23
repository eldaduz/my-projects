// ╔══════════════════════════════════════════════════════════════════╗
// ║ CENTRALIZED ERROR HANDLING                                       ║
// ║                                                                  ║
// ║ REUSE: HttpError is used in EVERY controller and middleware      ║
// ║ across the entire server (auth, trips, travelers, enrichment,    ║
// ║ requireAuth, loadOwnedResource, rateLimiters, etc.)              ║
// ║                                                                  ║
// ║ PATTERN: Custom Error Class — HttpError extends JavaScript's     ║
// ║ built-in Error with HTTP status and machine-readable code.       ║
// ║ This gives us ONE consistent error shape: { error: { message, code } } ║
// ║                                                                  ║
// ║ TEACHER Q: "Why not just do res.status(400).json(...)" in each   ║
// ║ controller?" → Because then error formatting is scattered across ║
// ║ 50+ places. With HttpError + errorHandler, formatting is in ONE  ║
// ║ place. Change it once = changes everywhere. DRY principle.       ║
// ╚══════════════════════════════════════════════════════════════════╝
const DEFAULT_MESSAGE = 'Something went wrong. Please try again.'

// STUDY NOTE: This extends JavaScript's built-in Error class.
// status = HTTP status code (400, 401, 404, 500, etc.)
// code = machine-readable string like 'INVALID_EMAIL' (for the frontend to switch on)
// TEACHER Q: "Why extend Error?" → So we can throw HttpError and it works
// with try/catch and next(err) just like any other error.
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } })
}

// STUDY NOTE: Express identifies error-handling middleware by its 4 parameters:
// (err, req, res, next). The eslint-disable comment is because `next` isn't
// used but MUST be present for Express to recognize this as an error handler.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500

  // body-parser's JSON SyntaxError carries the raw V8 parser message (e.g.
  // "Expected property name or '}' in JSON at position 1") in err.message —
  // internal parser detail, not something the app authored, so it's excluded
  // from the "trust err.message on 4xx" rule below (ATP-82 PT finding).
  const isBodyParseError = err.type === 'entity.parse.failed'

  // Never leak stack traces, internal messages, or provider/library details.
  // A 5xx can still arrive with err.status set (e.g. HttpError(500, ...) or a
  // 3rd-party error), so gate on status rather than on err.status being set.
  const message =
    status < 500 && err.message && !isBodyParseError
      ? err.message
      : isBodyParseError
        ? 'Invalid request body.'
        : DEFAULT_MESSAGE
  const code = isBodyParseError ? 'INVALID_JSON' : err.code

  if (status >= 500) {
    console.error(err)
  }

  res.status(status).json({ error: { message, code } })
}
