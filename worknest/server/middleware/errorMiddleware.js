function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      message: 'Invalid JSON payload',
    });
  }

  const statusCode = err?.statusCode || err?.status || 500;
  const message = statusCode >= 500 ? 'Internal server error' : err.message;

  return res.status(statusCode).json({
    message,
  });
}

export default errorMiddleware;
