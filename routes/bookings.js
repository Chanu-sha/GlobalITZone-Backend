import express from "express";
import Booking from "../models/Booking.js";
import Product from "../models/Product.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Private
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      productId,
      productName,
      productImage,
      productCategory,
      customerName,
      customerPhone,
      customerAddress,
      quantity,
      bookingDate,
      actualPrice,
      strikePrice,
      sellingPrice,
      totalAmount,
      discountPercentage,
    } = req.body;

    // Validate required fields
    if (
      !productId ||
      !customerName ||
      !customerPhone ||
      !customerAddress ||
      !quantity ||
      !bookingDate
    ) {
      return res.status(400).json({
        message: "Please provide all required fields",
      });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Check if product is available
    if (product.availability !== "Available") {
      return res.status(400).json({
        message: "Product is not available for booking",
      });
    }

    // Create booking with default 'confirmed' status
    const booking = await Booking.create({
      productId,
      productName,
      productImage,
      productCategory,
      userId: req.user._id,
      customerName,
      customerPhone,
      customerAddress,
      quantity,
      bookingDate,
      actualPrice: actualPrice || 0,
      strikePrice: strikePrice || 0,
      sellingPrice: sellingPrice || 0,
      totalAmount: totalAmount || 0,
      discountPercentage: discountPercentage || 0,
      status: "confirmed",
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      message: "Failed to create booking",
      error: error.message,
    });
  }
});

// @route   GET /api/bookings
// @desc    Get bookings (all for admin, user-specific otherwise)
// @access  Private
router.get("/", authenticateToken, async (req, res) => {
  try {
    let bookings;

    // Check if the user is an admin
    if (req.user.role === "admin") {
      // Admin gets ALL bookings, sorted by orderDate descending
      bookings = await Booking.find()
        .populate("productId", "name category")
        .populate("userId", "name email phone")
        .sort({ orderDate: -1 });
    } else {
      // Regular user gets only their own bookings
      bookings = await Booking.find({ userId: req.user._id })
        .populate("productId", "name category")
        .sort({ orderDate: -1 });
    }

    res.json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking by ID
// @access  Private
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("productId", "name category description features")
      .populate("userId", "name email phone");

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    // Check if user is admin or booking owner
    const isAdmin = req.user.role === "admin";
    const isOwner = booking.userId._id.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        message: "Not authorized to view this booking",
      });
    }

    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      message: "Failed to fetch booking",
      error: error.message,
    });
  }
});

// @route   PATCH /api/bookings/:id/cancel
// @desc    Cancel a booking
// @access  Private
router.patch("/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    // Check if user is admin or booking owner
    const isAdmin = req.user.role === "admin";
    const isOwner = booking.userId.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        message: "Not authorized to cancel this booking",
      });
    }

    // Check if booking is already cancelled
    if (booking.status === "cancelled") {
      return res.status(400).json({
        message: "Booking is already cancelled",
      });
    }

    // Check if booking is completed
    if (booking.status === "completed") {
      return res.status(400).json({
        message: "Cannot cancel a completed booking",
      });
    }

    // Update booking status to cancelled
    await booking.updateStatus("cancelled");
    booking.cancellationReason =
      req.body.reason ||
      (isAdmin ? "Cancelled by Admin" : "Cancelled by customer");
    await booking.save();

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({
      message: "Failed to cancel booking",
      error: error.message,
    });
  }
});

// @route   PATCH /api/bookings/:id/complete
// @desc    Mark a booking as completed (Admin only)
// @access  Private (Admin)
router.patch("/:id/complete", authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized. Admin access required.",
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if booking is already completed
    if (booking.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Booking is already marked as completed",
      });
    }

    // Check if booking is cancelled
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot complete a cancelled booking",
      });
    }

    // Update booking status to completed
    await booking.updateStatus("completed");
    await booking.save();

    res.json({
      success: true,
      message: "Booking marked as completed successfully",
      booking,
    });
  } catch (error) {
    console.error("Error completing booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete booking",
      error: error.message,
    });
  }
});

// @route   GET /api/bookings/coupon/:couponCode
// @desc    Get booking by coupon code
// @access  Private
router.get("/coupon/:couponCode", authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      couponCode: req.params.couponCode.toUpperCase(),
    })
      .populate("productId", "name category")
      .populate("userId", "name email phone");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found with this coupon code",
      });
    }

    // Check if user is admin or booking owner
    const isAdmin = req.user.role === "admin";
    const isOwner = booking.userId._id.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this booking",
      });
    }

    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Error fetching booking by coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
      error: error.message,
    });
  }
});

export default router;