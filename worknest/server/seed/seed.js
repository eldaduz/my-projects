import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Branch from '../models/Branch.js';
import Reservation from '../models/Reservation.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { calculateReservationTotalPrice } from '../utils/priceUtils.js';
import {
  createSeedReservations,
  seedBranches,
  seedUsers,
  workspaceTemplatesByBranch,
} from './seedData.js';

dotenv.config();

const SALT_ROUNDS = 10;
const DEMO_PASSWORD = 'Password123';

const getReservedDays = (startDate, endDate) => {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.round((endDate - startDate) / millisecondsPerDay);
};

const seedDatabase = async () => {
  try {
    await connectDB();

    await Reservation.deleteMany({});
    await Workspace.deleteMany({});
    await Branch.deleteMany({});
    await User.deleteMany({});

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

    const usersToInsert = seedUsers.map((user) => ({
      ...user,
      passwordHash,
    }));

    const createdUsers = await User.insertMany(usersToInsert);
    const createdBranches = await Branch.insertMany(seedBranches);

    const branchMap = new Map(createdBranches.map((branch) => [branch.name, branch]));

    const workspacesToInsert = createdBranches.flatMap((branch) =>
      workspaceTemplatesByBranch[branch.name].map((workspace) => ({
        ...workspace,
        branchId: branch._id,
      })),
    );

    const createdWorkspaces = await Workspace.insertMany(workspacesToInsert);

    const userMap = new Map(createdUsers.map((user) => [user.email, user]));

    const reservationSeeds = createSeedReservations();

    const reservationsToInsert = reservationSeeds.map((reservation) => {
      const user = userMap.get(reservation.userEmail);
      const branch = branchMap.get(reservation.branchName);
      const workspace = createdWorkspaces.find(
        (item) =>
          item.branchId.toString() === branch._id.toString() &&
          item.name === reservation.workspaceName,
      );

      if (!user || !branch || !workspace) {
        throw new Error('Reservation seed references missing user, branch, or workspace');
      }

      return {
        userId: user._id,
        branchId: branch._id,
        workspaceId: workspace._id,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        status: reservation.status,
        pricePerDayAtBooking: workspace.pricePerDay,
        totalPrice: calculateReservationTotalPrice({
          reservedDays: getReservedDays(reservation.startDate, reservation.endDate),
          pricePerDayAtBooking: workspace.pricePerDay,
        }),
      };
    });

    await Reservation.insertMany(reservationsToInsert);

    console.log('WorkNest seed completed successfully.');
  } catch (error) {
    console.error('WorkNest seed failed:', error.message);
  } finally {
    await mongoose.connection.close();
  }
};

seedDatabase();
