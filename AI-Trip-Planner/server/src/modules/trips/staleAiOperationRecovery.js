import { env } from '../../config/env.js';
import { Trip } from './trip.model.js';

// Which status a stuck AI operation reverts to. GENERATING always starts
// from READY_FOR_GENERATION (trips.controller.js); REPLANNING will always
// start from PLANNED once F17 lands — reverting to it here preserves the
// existing currentItinerary/itineraryStatus untouched, matching
// SECOND_BRAIN.md's "failed replan preserves the prior valid CurrentItinerary".
const RECOVERY_STATUS = {
  GENERATING: 'READY_FOR_GENERATION',
  REPLANNING: 'PLANNED',
};

// ponytail: lazy, on-read recovery (no cron/queue) — fine at this project's
// scale; a trip only self-heals the next time it's touched. If a background
// sweep is ever needed, add one then rather than now.
export async function recoverStaleTrip(trip) {
  const recoveredStatus = RECOVERY_STATUS[trip.status];
  const isStale =
    recoveredStatus && trip.startedAt && Date.now() - trip.startedAt.getTime() > env.aiStaleOperationMs;

  if (!isStale) return false;

  // Atomic and conditional on the exact status/startedAt we observed. A
  // plain trip.save() here would blindly overwrite whatever's in the DB —
  // if a concurrent request finished this same operation (e.g. it legitimately
  // reached PLANNED) between our read and this write, that would silently
  // revert real progress. This update only applies if nothing has changed
  // the trip since we read it.
  const result = await Trip.updateOne(
    { _id: trip._id, status: trip.status, startedAt: trip.startedAt },
    { $set: { status: recoveredStatus, startedAt: null } },
  );

  if (result.modifiedCount === 1) {
    trip.status = recoveredStatus;
    trip.startedAt = null;
    return true;
  }

  // Lost the race — something else already changed this trip. Refresh our
  // in-memory copy so the caller's response reflects the real current state
  // instead of our now-outdated snapshot.
  const fresh = await Trip.findById(trip._id);
  if (fresh) trip.set(fresh.toObject());
  return false;
}

export async function staleAiOperationRecovery(req, res, next) {
  try {
    await recoverStaleTrip(req.trip);
    next();
  } catch (err) {
    next(err);
  }
}
