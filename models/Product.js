import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        maxlength: [100, 'Product name cannot be more than 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Product description is required'],
        trim: true,
        maxlength: [1000, 'Description cannot be more than 1000 characters']
    },
    category: {
        type: String,
        required: [true, 'Product category is required'],
        enum: [
            'Laptops', 'Desktops', 'Security', 'Accessories', 'Audio',
            'Networking', 'Components', 'Monitors', 'Storage', 'Gaming'
        ]
    },
    condition: {
        type: String,
        required: [true, 'Product condition is required'],
        enum: ['New', 'Excellent', 'Very Good', 'Good', 'Fair']
    },
    type: {
        type: String,
        required: [true, 'Product type is required'],
        enum: ['Second Hand', 'New/Refurbished', 'Spare Parts', 'Refurbished']
    },
    availability: {
        type: String,
        enum: ['Available', 'Out of Stock', 'Discontinued'],
        default: 'Available'
    },
    features: [{
        type: String,
        trim: true,
        maxlength: [100, 'Feature cannot be more than 100 characters']
    }],
    // --- UPDATED FOR MULTIPLE IMAGES ---
    images: [{ // Array of image URLs/paths
        type: String,
        required: [true, 'Product image is required'] // Schema level requirement
    }],
    imagePublicIds: [{ // Array of Cloudinary Public IDs for deletion
        type: String
    }],
    // ------------------------------------
    price: {
        type: Number,
        min: [0, 'Price cannot be negative']
    },
    originalPrice: {
        type: Number,
        min: [0, 'Original price cannot be negative']
    },
    discount: {
        type: Number,
        min: [0, 'Discount cannot be negative'],
        max: [100, 'Discount cannot be more than 100%']
    },
    stock: {
        type: Number,
        default: 1,
        min: [0, 'Stock cannot be negative']
    },
    specifications: {
        brand: String,
        model: String,
        color: String,
        weight: String,
        dimensions: String,
        warranty: String,
        year: Number
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    views: {
        type: Number,
        default: 0
    },
    likes: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Index for better query performance
productSchema.index({ category: 1 });
productSchema.index({ condition: 1 });
productSchema.index({ type: 1 });
productSchema.index({ availability: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ name: 'text', description: 'text', category: 'text' });

// Virtual for formatted price
productSchema.virtual('formattedPrice').get(function() {
    if (this.price) {
        return `₹${this.price.toLocaleString('en-IN')}`;
    }
    return 'Contact for price';
});

// Method to increment views
productSchema.methods.incrementViews = function() {
    this.views += 1;
    return this.save();
};

// Method to toggle like
productSchema.methods.toggleLike = function() {
    this.likes += 1;
    return this.save();
};

export default mongoose.model('Product', productSchema);