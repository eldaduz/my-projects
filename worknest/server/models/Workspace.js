import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['office', 'smallMeetingRoom', 'largeMeetingRoom', 'managedSuite'],
    },
    capacity: {
      type: Number,
      required: true,
      min: 0.000001,
    },
    pricePerDay: {
      type: Number,
      required: true,
      min: 0.000001,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    equipment: {
      type: [
        {
          type: String,
          enum: ['projector', 'largeTv'],
        },
      ],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const Workspace = mongoose.model('Workspace', workspaceSchema);

export default Workspace;
