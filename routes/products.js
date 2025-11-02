import express from 'express';
import { body, validationResult, query } from 'express-validator';
import Product from '../models/Product.js';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth.js';
import { uploadMultiple, handleUploadError, deleteImage } from '../config/cloudinary.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// @route   GET /api/products
// @desc    Get all products with filtering and pagination
// @access  Public
router.get('/', [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('category').optional().isIn(['Laptops', 'Desktops', 'Security', 'Accessories', 'Audio', 'Networking', 'Components', 'Monitors', 'Storage', 'Gaming']).withMessage('Invalid category'),
    query('condition').optional().isIn(['New', 'Excellent', 'Very Good', 'Good', 'Fair']).withMessage('Invalid condition'),
    query('type').optional().isIn(['Second Hand', 'New/Refurbished', 'Spare Parts', 'Refurbished']).withMessage('Invalid type'),
    query('search').optional().isLength({ min: 1, max: 100 }).withMessage('Search term must be between 1 and 100 characters'),
    query('sort').optional().isIn(['newest', 'oldest', 'name', 'price-low', 'price-high', 'popular']).withMessage('Invalid sort option')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const {
            page = 1,
            limit = 12,
            category,
            condition,
            type,
            search,
            sort = 'newest'
        } = req.query;

        const filter = { isActive: true };

        if (category) filter.category = category;
        if (condition) filter.condition = condition;
        if (type) filter.type = type;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        let sortObj = {};
        switch (sort) {
            case 'newest':
                sortObj = { createdAt: -1 };
                break;
            case 'oldest':
                sortObj = { createdAt: 1 };
                break;
            case 'name':
                sortObj = { name: 1 };
                break;
            case 'price-low':
                sortObj = { price: 1 };
                break;
            case 'price-high':
                sortObj = { price: -1 };
                break;
            case 'popular':
                sortObj = { views: -1, likes: -1 };
                break;
            default:
                sortObj = { createdAt: -1 };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const products = await Product.find(filter)
            .sort(sortObj)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('createdBy', 'name email')
            .lean();

        const total = await Product.countDocuments(filter);
        const totalPages = Math.ceil(total / parseInt(limit));

        res.json({
            products,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalProducts: total,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ message: 'Server error while fetching products' });
    }
});

// @route   GET /api/products/:id
// @desc    Get single product by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('createdBy', 'name email')
            .lean();

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (!product.isActive) {
            return res.status(404).json({ message: 'Product not available' });
        }

        await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

        res.json({ product });
    } catch (error) {
        console.error('Get product error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid product ID' });
        }
        res.status(500).json({ message: 'Server error while fetching product' });
    }
});

// @route   POST /api/products
// @desc    Create new product
// @access  Private (Admin only)
router.post('/', [
    authenticateToken,
    requireAdmin,
    uploadMultiple,
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Product name must be between 2 and 100 characters'),
    body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
    body('category').isIn(['Laptops', 'Desktops', 'Security', 'Accessories', 'Audio', 'Networking', 'Components', 'Monitors', 'Storage', 'Gaming']).withMessage('Invalid category'),
    body('condition').isIn(['New', 'Excellent', 'Very Good', 'Good', 'Fair']).withMessage('Invalid condition'),
    body('type').isIn(['Second Hand', 'New/Refurbished', 'Spare Parts', 'Refurbished']).withMessage('Invalid type'),
    body('availability').optional().isIn(['Available', 'Out of Stock', 'Discontinued']).withMessage('Invalid availability status'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('features').optional().isArray().withMessage('Features must be an array')
], handleUploadError, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Image validation: Minimum 2, Maximum 5
        if (!req.files || req.files.length < 2) {
            return res.status(400).json({ message: 'Minimum 2 product images are required' });
        }
        
        if (req.files.length > 5) {
            return res.status(400).json({ message: 'Maximum 5 product images are allowed' });
        }

        const {
            name,
            description,
            category,
            condition,
            type,
            availability = 'Available',
            price,
            stock = 1,
            features = []
        } = req.body;

        let parsedFeatures = features;
        if (typeof features === 'string') {
            try {
                parsedFeatures = JSON.parse(features);
            } catch (e) {
                parsedFeatures = [];
            }
        }

        const imagePaths = req.files.map(file => file.path);
        const imagePublicIds = req.files.map(file => file.filename);

        const product = new Product({
            name,
            description,
            category,
            condition,
            type,
            availability,
            price: price ? parseFloat(price) : undefined,
            stock: parseInt(stock),
            features: parsedFeatures,
            images: imagePaths,
            imagePublicIds: imagePublicIds,
            createdBy: req.user._id
        });

        await product.save();

        res.status(201).json({
            message: 'Product created successfully',
            product
        });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ message: 'Server error while creating product' });
    }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private (Admin only)
router.put('/:id', [
    authenticateToken,
    requireAdmin,
    uploadMultiple,
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Product name must be between 2 and 100 characters'),
    body('description').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
    body('category').optional().isIn(['Laptops', 'Desktops', 'Security', 'Accessories', 'Audio', 'Networking', 'Components', 'Monitors', 'Storage', 'Gaming']).withMessage('Invalid category'),
    body('condition').optional().isIn(['New', 'Excellent', 'Very Good', 'Good', 'Fair']).withMessage('Invalid condition'),
    body('type').optional().isIn(['Second Hand', 'New/Refurbished', 'Spare Parts', 'Refurbished']).withMessage('Invalid type'),
    body('availability').optional().isIn(['Available', 'Out of Stock', 'Discontinued']).withMessage('Invalid availability status'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('existingImagePublicIds').optional().isArray().withMessage('Existing image IDs must be an array')
], handleUploadError, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const updateData = { ...req.body };
        const existingPublicIdsToKeep = updateData.existingImagePublicIds || [];
        delete updateData.existingImagePublicIds;

        let newImagePaths = [];
        let newImagePublicIds = [];
        let publicIdsToDelete = [];

        if (req.files && req.files.length > 0) {
            newImagePaths = req.files.map(file => file.path);
            newImagePublicIds = req.files.map(file => file.filename);
        }

        publicIdsToDelete = product.imagePublicIds.filter(id => !existingPublicIdsToKeep.includes(id));

        const keptImagePublicIds = product.imagePublicIds.filter(id => existingPublicIdsToKeep.includes(id));
        const keptImagePaths = product.images.filter((path, index) => existingPublicIdsToKeep.includes(product.imagePublicIds[index]));

        updateData.imagePublicIds = [...keptImagePublicIds, ...newImagePublicIds];
        updateData.images = [...keptImagePaths, ...newImagePaths];

        // Image validation: Total must be between 2 and 5
        if (updateData.images.length < 2) {
            return res.status(400).json({ message: 'Minimum 2 product images are required' });
        }
        
        if (updateData.images.length > 5) {
            return res.status(400).json({ message: 'Maximum 5 product images are allowed' });
        }

        if (publicIdsToDelete.length > 0) {
            await Promise.all(publicIdsToDelete.map(id => deleteImage(id)));
        }

        if (updateData.features && typeof updateData.features === 'string') {
            try {
                updateData.features = JSON.parse(updateData.features);
            } catch (e) {
                return res.status(400).json({ message: 'Invalid features format' });
            }
        }

        if (updateData.price) updateData.price = parseFloat(updateData.price);
        if (updateData.stock) updateData.stock = parseInt(updateData.stock);

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        res.json({
            message: 'Product updated successfully',
            product: updatedProduct
        });
    } catch (error) {
        console.error('Update product error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid product ID' });
        }
        res.status(500).json({ message: 'Server error while updating product' });
    }
});

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private (Admin only)
router.delete('/:id', [authenticateToken, requireAdmin], async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.imagePublicIds && product.imagePublicIds.length > 0) {
            await Promise.all(product.imagePublicIds.map(id => deleteImage(id)));
        }

        product.isActive = false;
        await product.save();

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid product ID' });
        }
        res.status(500).json({ message: 'Server error while deleting product' });
    }
});

// @route   GET /api/products/categories/list
// @desc    Get all available categories
// @access  Public
router.get('/categories/list', (req, res) => {
    const categories = [
        'Laptops', 'Desktops', 'Security', 'Accessories', 'Audio',
        'Networking', 'Components', 'Monitors', 'Storage', 'Gaming'
    ];

    res.json({ categories });
});

// @route   GET /api/products/stats/overview
// @desc    Get product statistics
// @access  Private (Admin only)
router.get('/stats/overview', [authenticateToken, requireAdmin], async (req, res) => {
    try {
        const stats = await Product.aggregate([
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    activeProducts: { $sum: { $cond: ['$isActive', 1, 0] } },
                    totalViews: { $sum: '$views' },
                    totalLikes: { $sum: '$likes' },
                    avgPrice: { $avg: '$price' }
                }
            }
        ]);

        const categoryStats = await Product.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    avgPrice: { $avg: '$price' }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({
            overview: stats[0] || {
                totalProducts: 0,
                activeProducts: 0,
                totalViews: 0,
                totalLikes: 0,
                avgPrice: 0
            },
            categoryStats
        });
    } catch (error) {
        console.error('Get product stats error:', error);
        res.status(500).json({ message: 'Server error while fetching product statistics' });
    }
});

export default router;