import mongoose from 'mongoose';
import { HttpError } from './errorHandler.js';

// Reusable ownership-scoped lookup: fetches `Model` by req.params[paramName],
// scoped to the authenticated owner, and stores it on req[resourceKey]. Any
// resource that doesn't exist, or belongs to someone else, is indistinguishable
// from "doesn't exist" to the caller — both return 404, never 403 — so this
// never leaks which IDs are in use by other users.
//
// Must run after requireAuth, which attaches req.userId.
export function loadOwnedResource(
  Model,
  { paramName = 'id', ownerField = 'userId', resourceKey = 'resource' } = {},
) {
  return async function (req, res, next) {
    try {
      const id = req.params[paramName];

      const resource = mongoose.isValidObjectId(id)
        ? await Model.findOne({ _id: id, [ownerField]: req.userId })
        : null;

      if (!resource) {
        throw new HttpError(404, 'Not found.', 'NOT_FOUND');
      }

      req[resourceKey] = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
}
