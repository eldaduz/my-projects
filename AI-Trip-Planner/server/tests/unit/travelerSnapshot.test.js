import { describe, test, expect } from 'vitest';
import mongoose from 'mongoose';
import { buildTravelerSnapshot } from '../../src/modules/trips/travelerSnapshot.js';

describe('buildTravelerSnapshot', () => {
  test('copies planning-relevant fields and stamps provenance', () => {
    const profileId = new mongoose.Types.ObjectId();
    const profile = {
      _id: profileId,
      profileName: 'Sam',
      ageGroup: 'adult',
      pace: 'balanced',
      hardConstraints: 'no stairs',
    };

    const snapshot = buildTravelerSnapshot(profile);

    expect(snapshot).toEqual({
      sourceTravelerProfileId: profileId,
      travelerName: 'Sam',
      ageGroup: 'adult',
      pace: 'balanced',
      hardConstraints: 'no stairs',
    });
  });

  test('uses profileName as the snapshot travelerName — there is no separate name field', () => {
    const profile = { _id: new mongoose.Types.ObjectId(), profileName: 'My Partner' };
    expect(buildTravelerSnapshot(profile).travelerName).toBe('My Partner');
  });

  test('leaves unset optional fields out of the snapshot', () => {
    const profile = { _id: new mongoose.Types.ObjectId(), profileName: 'Solo' };
    const snapshot = buildTravelerSnapshot(profile);
    expect(Object.keys(snapshot)).toEqual(['sourceTravelerProfileId', 'travelerName']);
  });
});
