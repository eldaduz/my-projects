import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import Reservation from '../models/Reservation.js';
import Workspace from '../models/Workspace.js';
import { hasConfirmedOverlappingReservation } from './availabilityService.js';
import { formatDateOnly, getReservedDaysExclusive } from '../utils/dateUtils.js';
import { calculateReservationTotalPrice } from '../utils/priceUtils.js';

const formatReservation = (reservation) => ({
  id: reservation._id.toString(),
  userId: reservation.userId.toString(),
  branchId: reservation.branchId.toString(),
  workspaceId: reservation.workspaceId.toString(),
  startDate: formatDateOnly(reservation.startDate),
  endDate: formatDateOnly(reservation.endDate),
  status: reservation.status,
  pricePerDayAtBooking: reservation.pricePerDayAtBooking,
  totalPrice: reservation.totalPrice,
});

const formatReservationSummary = (reservation) => ({
  id: reservation._id.toString(),
  branchId: reservation.branchId._id.toString(),
  branchName: reservation.branchId.name,
  workspaceId: reservation.workspaceId._id.toString(),
  workspaceName: reservation.workspaceId.name,
  startDate: formatDateOnly(reservation.startDate),
  endDate: formatDateOnly(reservation.endDate),
  status: reservation.status,
  pricePerDayAtBooking: reservation.pricePerDayAtBooking,
  totalPrice: reservation.totalPrice,
});

const formatReservationDetails = (reservation) => ({
  id: reservation._id.toString(),
  userId: reservation.userId.toString(),
  branchId: reservation.branchId._id.toString(),
  branchName: reservation.branchId.name,
  workspaceId: reservation.workspaceId._id.toString(),
  workspaceName: reservation.workspaceId.name,
  startDate: formatDateOnly(reservation.startDate),
  endDate: formatDateOnly(reservation.endDate),
  status: reservation.status,
  pricePerDayAtBooking: reservation.pricePerDayAtBooking,
  totalPrice: reservation.totalPrice,
});

const formatAdminReservation = (reservation) => ({
  id: reservation._id.toString(),
  userId: reservation.userId._id.toString(),
  userFullName: reservation.userId.fullName,
  branchId: reservation.branchId._id.toString(),
  branchName: reservation.branchId.name,
  workspaceId: reservation.workspaceId._id.toString(),
  workspaceName: reservation.workspaceId.name,
  startDate: formatDateOnly(reservation.startDate),
  endDate: formatDateOnly(reservation.endDate),
  status: reservation.status,
  pricePerDayAtBooking: reservation.pricePerDayAtBooking,
  totalPrice: reservation.totalPrice,
});

export const createReservationRecord = async ({
  userId,
  branchId,
  workspaceId,
  startDate,
  endDate,
}) => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    return {
      error: {
        statusCode: 404,
        message: 'Branch not found',
      },
    };
  }

  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    return {
      error: {
        statusCode: 404,
        message: 'Workspace not found',
      },
    };
  }

  const branch = await Branch.findOne({
    _id: branchId,
    isActive: true,
  }).lean();

  if (!branch) {
    return {
      error: {
        statusCode: 404,
        message: 'Branch not found',
      },
    };
  }

  const workspace = await Workspace.findOne({
    _id: workspaceId,
    isActive: true,
  }).lean();

  if (!workspace) {
    return {
      error: {
        statusCode: 404,
        message: 'Workspace not found',
      },
    };
  }

  if (workspace.branchId.toString() !== branchId) {
    return {
      error: {
        statusCode: 400,
        message: 'Workspace does not belong to the selected branch',
      },
    };
  }

  const hasOverlap = await hasConfirmedOverlappingReservation({
    workspaceId,
    startDate,
    endDate,
  });

  if (hasOverlap) {
    return {
      error: {
        statusCode: 409,
        message: 'Workspace is not available for the selected dates',
      },
    };
  }

  const reservedDays = getReservedDaysExclusive(startDate, endDate);
  const pricePerDayAtBooking = workspace.pricePerDay;
  const totalPrice = calculateReservationTotalPrice({
    reservedDays,
    pricePerDayAtBooking,
  });

  const reservation = await Reservation.create({
    userId,
    branchId,
    workspaceId,
    startDate,
    endDate,
    status: 'confirmed',
    pricePerDayAtBooking,
    totalPrice,
  });

  return {
    reservation: formatReservation(reservation),
  };
};

export const getReservationsForUser = async ({ userId, status }) => {
  const filters = { userId };

  if (status) {
    filters.status = status;
  }

  const reservations = await Reservation.find(filters)
    .populate('branchId', 'name')
    .populate('workspaceId', 'name')
    .lean();

  return reservations.map((reservation) => formatReservationSummary(reservation));
};

export const getReservationDetailsById = async (reservationId) => {
  const reservation = await Reservation.findById(reservationId)
    .populate('branchId', 'name')
    .populate('workspaceId', 'name')
    .lean();

  if (!reservation) {
    return null;
  }

  return formatReservationDetails(reservation);
};

export const cancelReservationById = async ({ reservationId, userId, role }) => {
  const reservation = await Reservation.findById(reservationId);

  if (!reservation) {
    return {
      error: {
        statusCode: 404,
        message: 'Reservation not found',
      },
    };
  }

  const isOwner = reservation.userId.toString() === userId;
  const isAdmin = role === 'admin';

  if (!isOwner && !isAdmin) {
    return {
      error: {
        statusCode: 403,
        message: 'Access denied',
      },
    };
  }

  if (reservation.status === 'cancelled') {
    return {
      error: {
        statusCode: 400,
        message: 'Reservation is already cancelled',
      },
    };
  }

  reservation.status = 'cancelled';
  await reservation.save();

  return {
    reservation: {
      id: reservation._id.toString(),
      status: reservation.status,
    },
  };
};

export const getAllReservationsForAdmin = async ({ status, userId, branchId, workspaceId }) => {
  const filters = {};

  if (status) {
    filters.status = status;
  }

  if (userId) {
    filters.userId = userId;
  }

  if (branchId) {
    filters.branchId = branchId;
  }

  if (workspaceId) {
    filters.workspaceId = workspaceId;
  }

  const reservations = await Reservation.find(filters)
    .populate('userId', 'fullName')
    .populate('branchId', 'name')
    .populate('workspaceId', 'name')
    .lean();

  return reservations.map((reservation) => formatAdminReservation(reservation));
};
