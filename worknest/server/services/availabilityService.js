import Branch from '../models/Branch.js';
import Reservation from '../models/Reservation.js';
import Workspace from '../models/Workspace.js';

const formatAvailableWorkspace = (workspace, branchName) => ({
  id: workspace._id.toString(),
  branchId: workspace.branchId.toString(),
  branchName,
  name: workspace.name,
  type: workspace.type,
  capacity: workspace.capacity,
  pricePerDay: workspace.pricePerDay,
  imageUrl: workspace.imageUrl,
  equipment: workspace.equipment,
});

// Core overlap check: two date ranges overlap when start1 < end2 AND start2 < end1.
// This single query covers all overlap cases (partial, full, contained).
export const hasConfirmedOverlappingReservation = async ({ workspaceId, startDate, endDate }) => {
  const overlappingReservation = await Reservation.findOne({
    workspaceId,
    status: 'confirmed',
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  }).lean();

  return Boolean(overlappingReservation);
};

// Three-step availability pipeline:
// 1. Find active branches matching filters
// 2. Find active workspaces within those branches
// 3. Exclude workspaces that have overlapping confirmed reservations
export const findAvailableWorkspaces = async ({
  startDate,
  endDate,
  branchId,
  type,
  minCapacity,
}) => {
  const branchFilters = { isActive: true };

  if (branchId) {
    branchFilters._id = branchId;
  }

  const branches = await Branch.find(branchFilters).select('_id name').lean();

  if (branches.length === 0) {
    return [];
  }

  const branchIds = branches.map((branch) => branch._id);
  const branchNamesById = new Map(branches.map((branch) => [branch._id.toString(), branch.name]));

  const workspaceFilters = {
    branchId: { $in: branchIds },
    isActive: true,
  };

  if (type) {
    workspaceFilters.type = type;
  }

  if (minCapacity !== undefined) {
    workspaceFilters.capacity = { $gte: minCapacity };
  }

  const workspaces = await Workspace.find(workspaceFilters).lean();

  if (workspaces.length === 0) {
    return [];
  }

  const workspaceIds = workspaces.map((workspace) => workspace._id);

  const overlappingReservations = await Reservation.find({
    workspaceId: { $in: workspaceIds },
    status: 'confirmed',
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  })
    .select('workspaceId')
    .lean();

  // Use a Set for O(1) lookup instead of nested array searches.
  const unavailableWorkspaceIds = new Set(
    overlappingReservations.map((reservation) => reservation.workspaceId.toString()),
  );

  return workspaces
    .filter((workspace) => !unavailableWorkspaceIds.has(workspace._id.toString()))
    .map((workspace) =>
      formatAvailableWorkspace(workspace, branchNamesById.get(workspace.branchId.toString())),
    );
};
