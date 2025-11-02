# Global IT Zone Backend API

This is the backend API for the Global IT Zone tech store application.

## Features

- User authentication and authorization
- Product management with image uploads
- Order management system
- Admin dashboard functionality
- Cloudinary integration for image storage
- MongoDB database with Mongoose ODM
- JWT-based authentication
- Input validation and error handling
- Rate limiting and security middleware

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- Cloudinary
- Multer
- Express Validator
- Bcryptjs

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/globalitzone
JWT_SECRET=your-super-secret-jwt-key-here
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
ADMIN_EMAIL=admin@globalitzone.com
ADMIN_PASSWORD=admin123
FRONTEND_URL=http://localhost:3000
```

3. Initialize admin user:
```bash
node scripts/initAdmin.js
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/admin-login` - Admin login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout

### Products
- `GET /api/products` - Get all products (with filtering)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (Admin only)
- `PUT /api/products/:id` - Update product (Admin only)
- `DELETE /api/products/:id` - Delete product (Admin only)
- `GET /api/products/categories/list` - Get categories
- `GET /api/products/stats/overview` - Get product stats (Admin only)

### Orders
- `GET /api/orders` - Get orders
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order
- `PUT /api/orders/:id/status` - Update order status (Admin only)
- `DELETE /api/orders/:id` - Cancel order
- `GET /api/orders/stats/overview` - Get order stats (Admin only)

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get single user (Admin only)
- `PUT /api/users/:id` - Update user (Admin only)
- `DELETE /api/users/:id` - Delete user (Admin only)
- `GET /api/users/:id/orders` - Get user orders (Admin only)
- `GET /api/users/stats/overview` - Get user stats (Admin only)

## Environment Variables

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT secret key
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `ADMIN_EMAIL` - Admin email for initialization
- `ADMIN_PASSWORD` - Admin password for initialization
- `FRONTEND_URL` - Frontend URL for CORS

## Security Features

- Helmet for security headers
- Rate limiting
- Input validation
- Password hashing with bcrypt
- JWT token authentication
- CORS configuration
- File upload validation

## Database Models

### User
- name, email, phone, password
- role (user/admin)
- isActive, lastLogin, profileImage

### Product
- name, description, category, condition, type
- availability, features, image, images
- price, originalPrice, discount, stock
- specifications, tags, isActive
- views, likes, createdBy

### Order
- orderNumber, user, items
- totalAmount, status, paymentStatus
- shippingAddress, billingAddress
- notes, estimatedDelivery, trackingNumber
