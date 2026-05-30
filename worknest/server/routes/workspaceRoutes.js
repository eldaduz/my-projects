import express from 'express';
import {
  createWorkspace,
  getAvailableWorkspaces,
  getBranchWorkspaces,
  getWorkspaceById,
  updateWorkspace,
} from '../controllers/workspaceController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.post('/workspaces', authMiddleware, adminMiddleware, createWorkspace);
router.put('/workspaces/:workspaceId', authMiddleware, adminMiddleware, updateWorkspace);
router.get('/workspaces/available', getAvailableWorkspaces);
router.get('/workspaces/:workspaceId', getWorkspaceById);
router.get('/branches/:branchId/workspaces', getBranchWorkspaces);

export default router;
