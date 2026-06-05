import express from 'express';
import {
  createBranch,
  getBranchById,
  getBranchBySlug,
  getBranches,
  getBranchesForAdmin,
  updateBranch,
} from '../controllers/branchController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.get('/', getBranches);
router.get('/admin/all', authMiddleware, adminMiddleware, getBranchesForAdmin);
router.get('/slug/:slug', getBranchBySlug);
router.post('/', authMiddleware, adminMiddleware, createBranch);
router.put('/:branchId', authMiddleware, adminMiddleware, updateBranch);
router.get('/:branchId', getBranchById);

export default router;
