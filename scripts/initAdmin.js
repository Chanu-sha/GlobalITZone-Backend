import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const initAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/globalitzone');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      process.exit(0);
    }

    // Create admin user
    const admin = new User({
      name: 'Admin User',
      email: process.env.ADMIN_EMAIL || 'admin@globalitzone.com',
      phone: '9999999999',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'admin'
    });

    await admin.save();
    console.log('Admin user created successfully:', admin.email);
    console.log('Default password:', process.env.ADMIN_PASSWORD || 'admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

// Run the script
initAdmin();
