import { describe, test, expect, vi } from 'vitest';
import { aiConcurrencyGuard } from '../../src/middleware/aiConcurrencyGuard.js';

describe('aiConcurrencyGuard', () => {
  test('release is independent of response socket events — a client disconnect (or anything else on res) never frees the slot', () => {
    const req = { user: { id: 'user-1' } };
    const res = {};
    const next = vi.fn();

    aiConcurrencyGuard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(typeof req.releaseAiConcurrencySlot).toBe('function');

    // A second request for the same user is still blocked — nothing but an
    // explicit call to req.releaseAiConcurrencySlot() frees the slot,
    // regardless of what happens to the first request's response/socket
    // (e.g. the client disconnecting before the handler finishes, which
    // previously leaked the slot forever via a missed 'finish' event).
    const secondReq = { user: { id: 'user-1' } };
    const secondRes = {};
    const secondNext = vi.fn();
    aiConcurrencyGuard(secondReq, secondRes, secondNext);

    expect(secondNext).toHaveBeenCalledWith(expect.objectContaining({ status: 409, code: 'AI_REQUEST_IN_PROGRESS' }));
  });

  test('releases the slot once the handler explicitly calls the release callback', () => {
    const req = { user: { id: 'user-2' } };
    const res = {};
    const next = vi.fn();

    aiConcurrencyGuard(req, res, next);
    req.releaseAiConcurrencySlot();

    const secondReq = { user: { id: 'user-2' } };
    const secondRes = {};
    const secondNext = vi.fn();
    aiConcurrencyGuard(secondReq, secondRes, secondNext);

    expect(secondNext).toHaveBeenCalledWith(); // called with no error — request allowed through
  });
});
