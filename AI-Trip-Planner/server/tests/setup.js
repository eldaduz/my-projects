process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-trip-planner-test';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production';
// High default so ordinary integration tests (many register/login calls from
// the same supertest IP) don't trip rate limiting; dedicated rate-limit tests
// override this before importing the app.
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '1000';
