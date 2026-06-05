import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4, 5],
    },
    facilities: {
      type: [
        {
          type: String,
          enum: [
            'wifi',
            'coffee',
            'printer',
            'kitchen',
            'parking',
            'bikeStorage',
            'petFriendly',
            'accessibility',
          ],
        },
      ],
      required: true,
      validate: {
        validator: (facilities) => facilities.includes('accessibility'),
        message: 'Facilities must include accessibility',
      },
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

const Branch = mongoose.model('Branch', branchSchema);

export default Branch;
