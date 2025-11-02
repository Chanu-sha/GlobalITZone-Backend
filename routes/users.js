import express from 'express';
import { body, validationResult, query } from 'express-validator';
import User from '../models/User.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private (Admin only)
router.get('/', [
  authenticateToken,
  requireAdmin,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('role').optional().isIn(['user', 'admin']).withMessage('Invalid role'),
  query('search').optional().isLength({ min: 1, max: 100 }).withMessage('Search term must be between 1 and 100 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const {
      page = 1,
      limit = 10,
      role,
      search
    } = req.query;

    // Build filter object
    const filter = {};

    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sortObj = { createdAt: -1 };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const users = await User.find(filter)
      .select('-password')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
});

// @route   GET /api/users/:id
// @desc    Get single user by ID
// @access  Private (Admin only)
router.get('/:id', [authenticateToken, requireAdmin], async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    res.status(500).json({ message: 'Server error while fetching user' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin only)
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').optional().matches(/^[6-9]\d{9}$/).withMessage('Please provide a valid 10-digit phone number'),
  body('role').optional().isIn(['user', 'admin']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from demoting themselves
    if (req.user._id.toString() === req.params.id && req.body.role === 'user') {
      return res.status(400).json({ message: 'Cannot demote yourself from admin role' });
    }

    const updateData = { ...req.body };

    // Check for email/phone conflicts
    if (updateData.email || updateData.phone) {
      const conflictFilter = {
        _id: { $ne: req.params.id }
      };

      if (updateData.email) {
        conflictFilter.email = updateData.email;
      }
      if (updateData.phone) {
        conflictFilter.phone = updateData.phone;
      }

      const existingUser = await User.findOne(conflictFilter);
      if (existingUser) {
        return res.status(400).json({ 
          message: existingUser.email === updateData.email ? 'Email already in use' : 'Phone number already in use' 
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    res.status(500).json({ message: 'Server error while updating user' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (soft delete)
// @access  Private (Admin only)
router.delete('/:id', [authenticateToken, requireAdmin], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Soft delete by setting isActive to false
    user.isActive = false;
    await user.save();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    res.status(500).json({ message: 'Server error while deleting user' });
  }
});

// @route   GET /api/users/stats/overview
// @desc    Get user statistics
// @access  Private (Admin only)
router.get('/stats/overview', [authenticateToken, requireAdmin], async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          adminUsers: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          regularUsers: { $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] } }
        }
      }
    ]);

    const monthlyStats = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);

    res.json({
      overview: stats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        adminUsers: 0,
        regularUsers: 0
      },
      monthlyStats,
      roleStats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error while fetching user statistics' });
  }
});

export default router;