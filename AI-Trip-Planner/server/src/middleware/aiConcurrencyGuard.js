import { HttpError } from './errorHandler.js';

// ponytail: single-process in-memory guard — correct as long as this API
// runs as one instance (current Render free-tier deployment target). If it
// ever scales to multiple instances, move this set into MongoDB (e.g. a
// per-user "activeAiRequest" flag) instead of adding Redis.
const activeUsers = new Set();

// At most one active Gemini request per user at a time (ATP-70), across all
// of that user's trips — the trip.status check alone only prevents two
// concurrent requests on the *same* trip.
export function aiConcurrencyGuard(req, res, next) {
  const userId = String(req.user.id);
  if (activeUsers.has(userId)) {
    console.warn(`AI concurrency guard rejected a second in-flight request for user ${userId}`);
    return next(new HttpError(409, 'You already have an AI request in progress.', 'AI_REQUEST_IN_PROGRESS'));
  }
  activeUsers.add(userId);
  // Release is tied to the handler's own completion (it must call this in a
  // finally block), not to response socket events. 'finish' only fires if
  // the writable stream completes normally; if the client disconnects
  // before the handler calls res.json() (e.g. aborting a hung Gemini
  // request), 'finish' never fires and the slot would leak forever. Plain
  // JS control flow (finally) runs regardless of the socket's state.
  req.releaseAiConcurrencySlot = () => activeUsers.delete(userId);
  next();
}
