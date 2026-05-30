import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import Workspace from '../models/Workspace.js';
import { findAvailableWorkspaces } from '../services/availabilityService.js';
import { getTodayStart, parseDateOnly } from '../utils/dateUtils.js';

const allowedWorkspaceTypes = ['office', 'smallMeetingRoom', 'largeMeetingRoom', 'managedSuite'];
const allowedEquipmentValues = ['projector', 'largeTv'];

const formatWorkspace = (workspace) => ({
  id: workspace._id.toString(),
  branchId: workspace.branchId.toString(),
  name: workspace.name,
  type: workspace.type,
  capacity: workspace.capacity,
  pricePerDay: workspace.pricePerDay,
  imageUrl: workspace.imageUrl,
  description: workspace.description,
  equipment: workspace.equipment,
});

const hasField = (object, fieldName) => Object.prototype.hasOwnProperty.call(object, fieldName);

export const getAvailableWorkspaces = async (req, res) => {
  try {
    const { startDate, endDate, branchId, type, minCapacity } = req.query;

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

    if (branchId && !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: 'Invalid branch ID' });
    }

    if (type && !allowedWorkspaceTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid workspace type' });
    }

    let numericMinCapacity;

    if (minCapacity !== undefined) {
      numericMinCapacity = Number(minCapacity);

      if (Number.isNaN(numericMinCapacity) || numericMinCapacity <= 0) {
        return res.status(400).json({ message: 'Minimum capacity must be a positive number' });
      }
    }

    const workspaces = await findAvailableWorkspaces({
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      branchId,
      type,
      minCapacity: numericMinCapacity,
    });

    const hasAvailableWorkspaces = workspaces.length > 0;

    return res.status(200).json({
      message: hasAvailableWorkspaces
        ? 'Available workspaces loaded successfully'
        : 'No workspaces are available for the selected dates',
      data: {
        count: workspaces.length,
        workspaces,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const getBranchWorkspaces = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { type, minCapacity } = req.query;

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: 'Invalid branch ID' });
    }

    if (type && !allowedWorkspaceTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid workspace type' });
    }

    if (minCapacity !== undefined) {
      const numericMinCapacity = Number(minCapacity);

      if (Number.isNaN(numericMinCapacity) || numericMinCapacity <= 0) {
        return res.status(400).json({ message: 'Minimum capacity must be a positive number' });
      }
    }

    const branch = await Branch.findOne({
      _id: branchId,
      isActive: true,
    }).lean();

    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    const workspaceFilters = {
      branchId,
      isActive: true,
    };

    if (type) {
      workspaceFilters.type = type;
    }

    if (minCapacity !== undefined) {
      workspaceFilters.capacity = { $gte: Number(minCapacity) };
    }

    const workspaces = await Workspace.find(workspaceFilters).lean();

    const safeWorkspaces = workspaces.map((workspace) => formatWorkspace(workspace));

    return res.status(200).json({
      message: 'Workspaces loaded successfully',
      data: {
        count: safeWorkspaces.length,
        workspaces: safeWorkspaces,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const getWorkspaceById = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ message: 'Invalid workspace ID' });
    }

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isActive: true,
    }).lean();

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const branch = await Branch.findOne({
      _id: workspace.branchId,
      isActive: true,
    }).lean();

    if (!branch) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    return res.status(200).json({
      message: 'Workspace loaded successfully',
      data: {
        workspace: formatWorkspace(workspace),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const createWorkspace = async (req, res) => {
  try {
    const {
      branchId,
      name,
      type,
      capacity,
      pricePerDay,
      imageUrl,
      description,
      equipment,
      isActive,
    } = req.body;

    if (!branchId) {
      return res.status(400).json({ message: 'Branch ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: 'Invalid branch ID' });
    }

    const branch = await Branch.findOne({
      _id: branchId,
      isActive: true,
    }).lean();

    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    if (!name) {
      return res.status(400).json({ message: 'Workspace name is required' });
    }

    if (!allowedWorkspaceTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid workspace type' });
    }

    if (Number.isNaN(Number(capacity)) || Number(capacity) <= 0) {
      return res.status(400).json({ message: 'Capacity must be a positive number' });
    }

    if (Number.isNaN(Number(pricePerDay)) || Number(pricePerDay) <= 0) {
      return res.status(400).json({ message: 'Price per day must be a positive number' });
    }

    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    if (!description) {
      return res.status(400).json({ message: 'Description is required' });
    }

    if (
      !Array.isArray(equipment) ||
      !equipment.every((item) => allowedEquipmentValues.includes(item))
    ) {
      return res.status(400).json({ message: 'Invalid equipment value' });
    }

    const workspaceData = {
      branchId,
      name,
      type,
      capacity: Number(capacity),
      pricePerDay: Number(pricePerDay),
      imageUrl,
      description,
      equipment,
    };

    if (isActive !== undefined) {
      workspaceData.isActive = isActive;
    }

    const workspace = await Workspace.create(workspaceData);

    return res.status(201).json({
      message: 'Workspace created successfully',
      data: {
        workspace: {
          ...formatWorkspace(workspace),
          isActive: workspace.isActive,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const updateWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ message: 'Invalid workspace ID' });
    }

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const updateData = {};

    if (hasField(req.body, 'branchId')) {
      const { branchId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        return res.status(400).json({ message: 'Invalid branch ID' });
      }

      const branch = await Branch.findOne({
        _id: branchId,
        isActive: true,
      }).lean();

      if (!branch) {
        return res.status(404).json({ message: 'Branch not found' });
      }

      updateData.branchId = branchId;
    }

    if (hasField(req.body, 'name')) {
      if (!req.body.name || !req.body.name.trim()) {
        return res.status(400).json({ message: 'Workspace name is required' });
      }

      updateData.name = req.body.name.trim();
    }

    if (hasField(req.body, 'type')) {
      if (!allowedWorkspaceTypes.includes(req.body.type)) {
        return res.status(400).json({ message: 'Invalid workspace type' });
      }

      updateData.type = req.body.type;
    }

    if (hasField(req.body, 'capacity')) {
      if (Number.isNaN(Number(req.body.capacity)) || Number(req.body.capacity) <= 0) {
        return res.status(400).json({ message: 'Capacity must be a positive number' });
      }

      updateData.capacity = Number(req.body.capacity);
    }

    if (hasField(req.body, 'pricePerDay')) {
      if (Number.isNaN(Number(req.body.pricePerDay)) || Number(req.body.pricePerDay) <= 0) {
        return res.status(400).json({ message: 'Price per day must be a positive number' });
      }

      updateData.pricePerDay = Number(req.body.pricePerDay);
    }

    if (hasField(req.body, 'imageUrl')) {
      if (!req.body.imageUrl || !req.body.imageUrl.trim()) {
        return res.status(400).json({ message: 'Image URL is required' });
      }

      updateData.imageUrl = req.body.imageUrl.trim();
    }

    if (hasField(req.body, 'description')) {
      if (!req.body.description || !req.body.description.trim()) {
        return res.status(400).json({ message: 'Description is required' });
      }

      updateData.description = req.body.description.trim();
    }

    if (hasField(req.body, 'equipment')) {
      const { equipment } = req.body;

      if (
        !Array.isArray(equipment) ||
        !equipment.every((item) => allowedEquipmentValues.includes(item))
      ) {
        return res.status(400).json({ message: 'Invalid equipment value' });
      }

      updateData.equipment = equipment;
    }

    if (hasField(req.body, 'isActive')) {
      updateData.isActive = req.body.isActive;
    }

    Object.assign(workspace, updateData);
    await workspace.save();

    return res.status(200).json({
      message: 'Workspace updated successfully',
      data: {
        workspace: {
          ...formatWorkspace(workspace),
          isActive: workspace.isActive,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};
