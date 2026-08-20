const DEFAULT_MESSAGE = 'Something went wrong. Please try again.'

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
