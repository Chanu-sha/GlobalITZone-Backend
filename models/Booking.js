import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  // Product Information
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productImage: {
    type: String,
    required: true
  },
  productCategory: {
    type: String,
    required: true
  },

  // Customer Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  customerPhone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  customerAddress: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },

  // Order Details
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  bookingDate: {
    type: Date,
    required: [true, 'Booking date is required']
  },
  orderDate: {
    type: Date,
    default: Date.now
  },

  // Pricing Information
  actualPrice: {
    type: Number,
    required: true,
    min: [0, 'Actual price cannot be negative']
  },
  strikePrice: {
    type: Number,
    required: true,
    min: [0, 'Strike price cannot be negative']
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: [0, 'Selling price cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100%']
  },

  // Auto-generated unique Coupon Code
  couponCode: {
    type: String,
    unique: true,
    uppercase: true,
    default: function () {
      return generateCouponCode();
    }
  },

  // Order Status - UPDATED to include 'completed'
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'completed'],
    default: 'confirmed'
  },

  // Additional Information
  notes: {
    type: String,
    trim: true
  },
  
  // Timestamps for status changes
  cancelledAt: Date,
  cancellationReason: String,
  completedAt: Date

}, {
  timestamps: true
});

// Indexes for better query performance
bookingSchema.index({ userId: 1 });
bookingSchema.index({ productId: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ orderDate: -1 });

// Function to generate a unique coupon code
function generateCouponCode() {
  const prefix = 'GIT';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Method to update booking status
bookingSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  
  if (newStatus === 'cancelled') {
    this.cancelledAt = new Date();
  } else if (newStatus === 'completed') {
    this.completedAt = new Date();
  }
  
  return this.save();
};

export default mongoose.model('Booking', bookingSchema);