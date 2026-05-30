import mongoose from 'mongoose';
import {
  cancelReservationById,
  createReservationRecord,
  getAllReservationsForAdmin,
  getReservationDetailsById,
  getReservationsForUser,
} from '../services/reservationService.js';
import { getTodayStart, parseDateOnly } from '../utils/dateUtils.js';

const allowedReservationStatuses = ['confirmed', 'cancelled'];

export const createReservation = async (req, res) => {
  try {
    const { branchId, workspaceId, startDate, endDate } = req.body;

    if (!branchId) {
      return res.status(400).json({ message: 'Branch ID is required' });
    }

    if (!workspaceId) {
      return res.status(400).json({ message: 'Workspace ID is required' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    const parsedStartDate = parseDateOnly(startDate);
    const parsedEndDate = parseDateOnly(endDate);

    if (!parsedStartDate || !parsedEndDate) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    if (parsedStartDate < getTodayStart()) {
      return res.status(400).json({ message: 'Start date cannot be in the past' });
    }

    if (parsedEndDate <= parsedStartDate) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const result = await createReservationRecord({
      userId: req.user.id,
      branchId,
      workspaceId,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });

    if (result.error) {
      return res.status(result.error.statusCode).json({ message: result.error.message });
    }

    return res.status(201).json({
      message: 'Reservation created successfully',
      data: {
        reservation: result.reservation,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const getMyReservations = async (req, res) => {
  try {
    const { status } = req.query;

    if (status && !allowedReservationStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid reservation status' });
    }

    const reservations = await getReservationsForUser({
      userId: req.user.id,
      status,
    });

    return res.status(200).json({
      message: 'Reservations loaded successfully',
      data: {
        count: reservations.length,
        reservations,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const getReservationById = async (req, res) => {
  try {
    const { reservationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reservationId)) {
      return res.status(400).json({ message: 'Invalid reservation ID' });
    }

    const reservation = await getReservationDetailsById(reservationId);

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    const isOwner = reservation.userId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.status(200).json({
      message: 'Reservation loaded successfully',
      data: {
        reservation,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const cancelReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reservationId)) {
      return res.status(400).json({ message: 'Invalid reservation ID' });
    }

    const result = await cancelReservationById({
      reservationId,
      userId: req.user.id,
      role: req.user.role,
    });

    if (result.error) {
      return res.status(result.error.statusCode).json({ message: result.error.message });
    }

    return res.status(200).json({
      message: 'Reservation cancelled successfully',
      data: {
        reservation: result.reservation,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const getAllReservations = async (req, res) => {
  try {
    const { status, userId, branchId, workspaceId } = req.query;

    if (status && !allowedReservationStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid reservation status' });
    }

    const objectIdFilters = [userId, branchId, workspaceId].filter(Boolean);

    if (objectIdFilters.some((value) => !mongoose.Types.ObjectId.isValid(value))) {
      return res.status(400).json({ message: 'Invalid query value' });
    }

    const reservations = await getAllReservationsForAdmin({
      status,
      userId,
      branchId,
      workspaceId,
    });

    return res.status(200).json({
      message: 'All reservations loaded successfully',
      data: {
        count: reservations.length,
        reservations,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};
