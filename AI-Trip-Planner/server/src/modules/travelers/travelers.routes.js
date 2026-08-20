import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { loadOwnedResource } from '../../middleware/loadOwnedResource.js';
import { TravelerProfile } from './travelerProfile.model.js';
import {
  createProfile,
  listProfiles,
  getProfile,
  updateProfile,
  deleteProfile,
} from './travelers.controller.js';

export const travelersRouter = Router();

const loadOwnedProfile = loadOwnedResource(TravelerProfile, { resourceKey: 'profile' });

travelersRouter.use(requireAuth);

travelersRouter.post('/', createProfile);
travelersRouter.get('/', listProfiles);
travelersRouter.get('/:id', loadOwnedProfile, getProfile);
travelersRouter.patch('/:id', loadOwnedProfile, updateProfile);
travelersRouter.delete('/:id', loadOwnedProfile, deleteProfile);
