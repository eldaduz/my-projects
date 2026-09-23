import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadEnv() {
  vi.resetModules();
  return import('../../src/config/env.js');
}

describe('env config', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test('loads configuration with defaults when optional vars are unset', async () => {
    delete process.env.PORT;
    delete process.env.CORS_ORIGIN;

    const { env } = await loadEnv();

    expect(env.port).toBe(5000);
    expect(env.corsOrigin).toBe('http://localhost:5173');
    expect(env.mongoUri).toBe(process.env.MONGODB_URI);
    expect(env.geminiModel).toBe('gemini-3.5-flash-lite');
  });

  test('throws a clear error when MONGODB_URI is missing', async () => {
    delete process.env.MONGODB_URI;

    await expect(loadEnv()).rejects.toThrow(/MONGODB_URI/);
  });

  test('throws a clear error when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;

    await expect(loadEnv()).rejects.toThrow(/JWT_SECRET/);
  });

  test('AI rate limit and stale-operation defaults', async () => {
    delete process.env.AI_RATE_LIMIT_MAX;
    delete process.env.AI_RATE_LIMIT_WINDOW_MS;
    delete process.env.AI_RATE_LIMIT_IP_MAX;
    delete process.env.AI_STALE_OPERATION_MS;

    const { env } = await loadEnv();

    expect(env.aiRateLimitMax).toBe(5);
    expect(env.aiRateLimitWindowMs).toBe(5 * 60 * 1000);
    expect(env.aiRateLimitIpMax).toBe(20);
    expect(env.aiStaleOperationMs).toBe(2 * 60 * 1000);
  });

  test('aiAdapterMode defaults to real and only turns fake outside production', async () => {
    delete process.env.AI_ADAPTER_MODE;
    process.env.NODE_ENV = 'development';
    expect((await loadEnv()).env.aiAdapterMode).toBe('real');

    process.env.AI_ADAPTER_MODE = 'fake';
    process.env.NODE_ENV = 'development';
    expect((await loadEnv()).env.aiAdapterMode).toBe('fake');

    process.env.AI_ADAPTER_MODE = 'fake';
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_PROXY_SECRET = 'prod-secret';
    expect((await loadEnv()).env.aiAdapterMode).toBe('real');
  });

  test('throws a clear error when INTERNAL_PROXY_SECRET is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.INTERNAL_PROXY_SECRET;

    await expect(loadEnv()).rejects.toThrow(/INTERNAL_PROXY_SECRET/);
  });

  test('does not require INTERNAL_PROXY_SECRET outside production', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.INTERNAL_PROXY_SECRET;

    await expect(loadEnv()).resolves.toBeDefined();
  });

  test('pexelsApiKey is undefined when not set', async () => {
    delete process.env.PEXELS_API_KEY;
    const { env } = await loadEnv();
    expect(env.pexelsApiKey).toBeUndefined();
  });

  test('enrichment rate limit defaults apply when unset', async () => {
    delete process.env.ENRICHMENT_RATE_LIMIT_MAX;
    delete process.env.ENRICHMENT_RATE_LIMIT_WINDOW_MS;
    const { env } = await loadEnv();
    expect(env.enrichmentRateLimitMax).toBe(30);
    expect(env.enrichmentRateLimitWindowMs).toBe(60000);
  });

  test('photo rate limit defaults apply when unset', async () => {
    delete process.env.PHOTO_RATE_LIMIT_MAX;
    delete process.env.PHOTO_RATE_LIMIT_WINDOW_MS;
    const { env } = await loadEnv();
    expect(env.photoRateLimitMax).toBe(180);
    expect(env.photoRateLimitWindowMs).toBe(60 * 60 * 1000);
  });
});
