import express from 'express';
import {
  cancelReservation,
  createReservation,
  getAllReservations,
  getMyReservations,
  getReservationById,
} from '../controllers/reservationController.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, adminMiddleware, getAllReservations);
router.get('/my', authMiddleware, getMyReservations);
router.patch('/:reservationId/cancel', authMiddleware, cancelReservation);
router.get('/:reservationId', authMiddleware, getReservationById);
router.post('/', authMiddleware, createReservation);

export default router;
