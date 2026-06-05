import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import { createBranchSlug } from '../utils/branchSlug.js';

const isValidRating = (rating) => {
  return ['1', '2', '3', '4', '5'].includes(rating);
};

const allowedFacilities = [
  'wifi',
  'coffee',
  'printer',
  'kitchen',
  'parking',
  'bikeStorage',
  'petFriendly',
  'accessibility',
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasField = (object, fieldName) => Object.prototype.hasOwnProperty.call(object, fieldName);

const getBranchSlug = (branch) => branch.slug || createBranchSlug(branch.name);

const formatBranch = (branch) => ({
  id: branch._id.toString(),
  name: branch.name,
  slug: getBranchSlug(branch),
  city: branch.city,
  address: branch.address,
  imageUrl: branch.imageUrl,
  rating: branch.rating,
  facilities: branch.facilities,
  isActive: branch.isActive,
});

const formatPublicBranch = (branch) => {
  const safeBranch = formatBranch(branch);
  delete safeBranch.isActive;
  return safeBranch;
};

const findActiveBranchBySlug = async (slug) => {
  const branch = await Branch.findOne({
    slug,
    isActive: true,
  }).lean();

  if (branch) {
    return branch;
  }

  const activeBranches = await Branch.find({ isActive: true }).lean();
  const fallbackBranch = activeBranches.find((candidate) => getBranchSlug(candidate) === slug);

  if (!fallbackBranch) {
    return null;
  }

  if (!fallbackBranch.slug) {
    await Branch.updateOne(
      {
        _id: fallbackBranch._id,
        $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
      },
      { slug },
    );
    fallbackBranch.slug = slug;
  }

  return fallbackBranch;
};

const buildBranchFilters = ({ search, city, rating, includeInactive = false }) => {
  const filters = {};

  if (!includeInactive) {
    filters.isActive = true;
  }

  if (rating !== undefined) {
    if (!isValidRating(rating)) {
      return {
        error: {
          status: 400,
          message: 'Invalid query value',
        },
      };
    }

    filters.rating = Number(rating);
  }

  if (search) {
    filters.name = { $regex: search, $options: 'i' };
  }

  if (city) {
    filters.city = { $regex: `^${city}$`, $options: 'i' };
  }

  return { filters };
};

export const getBranches = async (req, res) => {
  try {
    const { search, city, rating } = req.query;
    const { filters, error } = buildBranchFilters({ search, city, rating });

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const branches = await Branch.find(filters).lean();

    const safeBranches = branches.map((branch) => formatPublicBranch(branch));

    return res.status(200).json({
      message: 'Branches loaded successfully',
      data: {
        count: safeBranches.length,
        branches: safeBranches,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const getBranchesForAdmin = async (req, res) => {
  try {
    const { search, city, rating, includeInactive } = req.query;
    const { filters, error } = buildBranchFilters({
      search,
      city,
      rating,
      includeInactive: includeInactive === 'true',
    });

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const branches = await Branch.find(filters).lean();

    return res.status(200).json({
      message: 'Branches loaded successfully',
      data: {
        count: branches.length,
        branches: branches.map((branch) => formatBranch(branch)),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const getBranchById = async (req, res) => {
  try {
    const { branchId } = req.params;

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

    return res.status(200).json({
      message: 'Branch loaded successfully',
      data: {
        branch: formatPublicBranch(branch),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const getBranchBySlug = async (req, res) => {
  try {
    const normalizedSlug = createBranchSlug(req.params.slug);

    if (!normalizedSlug) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    const branch = await findActiveBranchBySlug(normalizedSlug);

    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    return res.status(200).json({
      message: 'Branch loaded successfully',
      data: {
        branch: formatPublicBranch(branch),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const createBranch = async (req, res) => {
  try {
    const { name, slug, city, address, imageUrl, rating, facilities, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Branch name is required' });
    }

    if (!city) {
      return res.status(400).json({ message: 'City is required' });
    }

    if (!address) {
      return res.status(400).json({ message: 'Address is required' });
    }

    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    if (![1, 2, 3, 4, 5].includes(Number(rating))) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (!Array.isArray(facilities)) {
      return res.status(400).json({ message: 'Facilities must be an array' });
    }

    if (!facilities.every((facility) => allowedFacilities.includes(facility))) {
      return res.status(400).json({ message: 'Invalid facility value' });
    }

    if (!facilities.includes('accessibility')) {
      return res.status(400).json({ message: 'Facilities must include accessibility' });
    }

    const trimmedName = name.trim();
    const trimmedCity = city.trim();
    const trimmedAddress = address.trim();
    const nextSlug = createBranchSlug(slug || trimmedName);

    if (!nextSlug) {
      return res.status(400).json({ message: 'Branch slug is required' });
    }

    const existingBranch = await Branch.findOne({
      name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' },
      city: { $regex: `^${escapeRegex(trimmedCity)}$`, $options: 'i' },
      address: { $regex: `^${escapeRegex(trimmedAddress)}$`, $options: 'i' },
    });

    if (existingBranch) {
      return res.status(409).json({ message: 'Branch already exists' });
    }

    const existingSlug = await Branch.findOne({ slug: nextSlug });

    if (existingSlug) {
      return res.status(409).json({ message: 'Branch slug already exists' });
    }

    const newBranchData = {
      name: trimmedName,
      slug: nextSlug,
      city: trimmedCity,
      address: trimmedAddress,
      imageUrl,
      rating: Number(rating),
      facilities,
    };

    if (isActive !== undefined) {
      newBranchData.isActive = isActive;
    }

    const branch = await Branch.create(newBranchData);

    return res.status(201).json({
      message: 'Branch created successfully',
      data: {
        branch: formatBranch(branch),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};

export const updateBranch = async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: 'Invalid branch ID' });
    }

    const branch = await Branch.findById(branchId);

    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    const updateData = {};

    if (hasField(req.body, 'name')) {
      if (!req.body.name || !req.body.name.trim()) {
        return res.status(400).json({ message: 'Branch name is required' });
      }

      updateData.name = req.body.name.trim();
    }

    if (hasField(req.body, 'slug')) {
      const nextSlug = createBranchSlug(req.body.slug);

      if (!nextSlug) {
        return res.status(400).json({ message: 'Branch slug is required' });
      }

      updateData.slug = nextSlug;
    }

    if (hasField(req.body, 'city')) {
      if (!req.body.city || !req.body.city.trim()) {
        return res.status(400).json({ message: 'City is required' });
      }

      updateData.city = req.body.city.trim();
    }

    if (hasField(req.body, 'address')) {
      if (!req.body.address || !req.body.address.trim()) {
        return res.status(400).json({ message: 'Address is required' });
      }

      updateData.address = req.body.address.trim();
    }

    if (hasField(req.body, 'imageUrl')) {
      if (!req.body.imageUrl || !req.body.imageUrl.trim()) {
        return res.status(400).json({ message: 'Image URL is required' });
      }

      updateData.imageUrl = req.body.imageUrl.trim();
    }

    if (hasField(req.body, 'rating')) {
      if (![1, 2, 3, 4, 5].includes(Number(req.body.rating))) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }

      updateData.rating = Number(req.body.rating);
    }

    if (hasField(req.body, 'facilities')) {
      const { facilities } = req.body;

      if (!Array.isArray(facilities)) {
        return res.status(400).json({ message: 'Facilities must be an array' });
      }

      if (!facilities.every((facility) => allowedFacilities.includes(facility))) {
        return res.status(400).json({ message: 'Invalid facility value' });
      }

      if (!facilities.includes('accessibility')) {
        return res.status(400).json({ message: 'Facilities must include accessibility' });
      }

      updateData.facilities = facilities;
    }

    if (hasField(req.body, 'isActive')) {
      updateData.isActive = req.body.isActive;
    }

    const nextName = hasField(updateData, 'name') ? updateData.name : branch.name;
    const nextCity = hasField(updateData, 'city') ? updateData.city : branch.city;
    const nextAddress = hasField(updateData, 'address') ? updateData.address : branch.address;

    const duplicateBranch = await Branch.findOne({
      _id: { $ne: branchId },
      name: { $regex: `^${escapeRegex(nextName.trim())}$`, $options: 'i' },
      city: { $regex: `^${escapeRegex(nextCity.trim())}$`, $options: 'i' },
      address: { $regex: `^${escapeRegex(nextAddress.trim())}$`, $options: 'i' },
    });

    if (duplicateBranch) {
      return res.status(409).json({ message: 'Branch already exists' });
    }

    if (hasField(updateData, 'slug')) {
      const duplicateSlug = await Branch.findOne({
        _id: { $ne: branchId },
        slug: updateData.slug,
      });

      if (duplicateSlug) {
        return res.status(409).json({ message: 'Branch slug already exists' });
      }
    }

    if (!branch.slug && !hasField(updateData, 'slug')) {
      updateData.slug = createBranchSlug(nextName);
    }

    Object.assign(branch, updateData);
    await branch.save();

    return res.status(200).json({
      message: 'Branch updated successfully',
      data: {
        branch: formatBranch(branch),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unexpected backend error' });
  }
};
