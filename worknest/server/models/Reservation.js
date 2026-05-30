import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed',
      required: true,
    },
    pricePerDayAtBooking: {
      type: Number,
      required: true,
      min: 0.000001,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0.000001,
    },
  },
  {
    timestamps: true,
  },
);

const Reservation = mongoose.model('Reservation', reservationSchema);

export default Reservation;
