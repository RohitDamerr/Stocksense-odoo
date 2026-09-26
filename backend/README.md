# StockSense Backend

A comprehensive inventory management system built with Node.js, Express, and MongoDB. Features multi-warehouse support, role-based authentication, real-time stock tracking, and automated notifications.

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone <repository-url>
cd stocksense-backend
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 3. Generate JWT secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))" 
node -e "console.log('OTP_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# 4. Start server
npm start

# 5. Health check
curl http://localhost:5000/health
```

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Environment Configuration](#environment-configuration)
- [Authentication](#authentication)
- [Product & Category Management](#product--category-management)
- [Warehouse Operations](#warehouse-operations)
- [Multi-Warehouse Support](#multi-warehouse-support)
- [Notifications System](#notifications-system)
- [User Profile Management](#user-profile-management)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Error Handling](#error-handling)

## 🏗️ Architecture Overview

### Core Components

- **Authentication Service**: JWT-based auth with OTP password reset
- **Product Management**: Categories, products, and stock tracking
- **Warehouse Operations**: Receipts, deliveries, transfers, and adjustments
- **Notification System**: Proactive alerts for low stock, pending operations
- **User Management**: Profile management and role-based access control

### Key Features

✅ **Multi-warehouse inventory tracking**  
✅ **Role-based access control** (Admin, Inventory Manager, Warehouse Staff)  
✅ **Double-entry stock ledger** for audit trail  
✅ **Automated stock level monitoring**  
✅ **Real-time notifications**  
✅ **Category hierarchy support**  
✅ **Location-based filtering**  
✅ **Comprehensive API documentation**  

### Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with refresh mechanism
- **Validation**: Joi schema validation
- **Email**: Nodemailer for OTP delivery
- **Scheduling**: node-cron for background jobs

## 🔧 Environment Configuration

### Required Environment Variables

Create a `.env` file from `.env.example`:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
MONGO_URI=mongodb://localhost:27017/stocksense

# JWT Secrets (generate with crypto.randomBytes)
JWT_SECRET=your_jwt_secret_64_bytes
REFRESH_SECRET=your_refresh_secret_64_bytes  
OTP_SECRET=your_otp_secret_64_bytes

# Email Configuration (for OTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourcompany.com
```

### Database Setup

MongoDB will automatically create collections on first use. The application includes:
- Automatic indexing for optimal query performance
- Data validation at the schema level
- Compound indexes for complex queries

## 🔐 Authentication

### User Roles

| Role | Permissions |
|------|-------------|
| **admin** | Full system access, user management |
| **inventory_manager** | Product management, operation validation |
| **warehouse_staff** | Operation execution, stock handling |

### Authentication Flow

1. **Registration**: `POST /api/auth/signup`
2. **Login**: `POST /api/auth/login` → Returns access token + refresh cookie
3. **Token Refresh**: `POST /api/auth/refresh`
4. **Password Reset**: OTP-based flow via email
5. **Logout**: `POST /api/auth/logout`

### API Authentication

All protected endpoints require:
```
Authorization: Bearer <access_token>
```

Access tokens expire in 15 minutes. Refresh tokens (HTTP-only cookies) expire in 7 days.

### Password Reset Flow

```
1. POST /api/auth/forgot-password { email }
2. Check email for 6-digit OTP
3. POST /api/auth/verify-otp { email, otp }
4. POST /api/auth/reset-password { resetToken, newPassword }
```

## 📦 Product & Category Management

### Categories

- **Hierarchical structure** with unlimited nesting
- **Path-based queries** for category trees
- **Cascade filtering** includes subcategories

```javascript
// Example category tree
Electronics/
├── Phones/
│   ├── Smartphones/
│   └── Accessories/
└── Computers/
    ├── Laptops/
    └── Desktops/
```

### Products

- **Unique SKU enforcement**
- **Reorder level monitoring**
- **Multi-location stock tracking**
- **Barcode support**
- **Unit of measure validation**

#### Supported Units of Measure
`pcs`, `kg`, `g`, `l`, `ml`, `box`, `carton`, `pack`, `pair`, `roll`, `m`, `cm`

## 🏭 Warehouse Operations

### Four Core Operations

#### 1. Receipts (Incoming Stock)
```
draft → waiting → ready → done
```
- **Draft**: Created with expected quantities
- **Waiting**: Partial quantities received
- **Ready**: All quantities received
- **Done**: Stock validated and added to inventory

#### 2. Deliveries (Outgoing Stock)  
```
draft → waiting → assigned → done
```
- **Draft**: Created with ordered quantities
- **Waiting**: Items picked from locations
- **Assigned**: Items packed for shipment
- **Done**: Stock validated and removed from inventory

#### 3. Internal Transfers
```
draft → waiting → done
```
- **Draft**: Transfer planned between locations/warehouses
- **Waiting**: Source stock confirmed available
- **Done**: Double-entry stock movement completed

#### 4. Stock Adjustments
```
draft → done
```
- **Draft**: Physical count entered
- **Done**: System quantity corrected to match physical count

### Stock Ledger System

All stock movements create immutable ledger entries:

```javascript
{
  product: ObjectId,
  warehouse: ObjectId,
  location: ObjectId,
  movementType: "receipt|delivery|transfer_in|transfer_out|adjustment",
  quantityChange: Number, // positive or negative
  balanceAfter: Number,
  reference: {
    docType: "Receipt|DeliveryOrder|InternalTransfer|StockAdjustment",
    docId: ObjectId,
    docNumber: String
  },
  performedBy: ObjectId,
  timestamp: Date
}
```

## 🏬 Multi-Warehouse Support

### Warehouse Structure

Each warehouse contains multiple locations:
```
Main Warehouse (WH01)
├── Receiving Dock (RCV-01)
├── Storage Rack A (RACK-A)
├── Storage Rack B (RACK-B)
└── Shipping Dock (SHP-01)

Secondary Warehouse (WH02)
├── Storage Area 1 (SA-01)
└── Storage Area 2 (SA-02)
```

### Stock Tracking

- **Per-location quantities**: Track exact location of each product
- **Warehouse-level summaries**: Aggregate quantities by warehouse
- **Company-wide totals**: System-wide inventory visibility
- **Reserved quantities**: Track committed but not yet shipped stock

### Location Filtering

All list endpoints support `?locationId=X` parameter:
- `GET /api/products?locationId=X` - Products with stock at location
- `GET /api/receipts?locationId=X` - Receipts targeting location
- `GET /api/delivery-orders?locationId=X` - Deliveries from location
- `GET /api/internal-transfers?locationId=X` - Transfers involving location
- `GET /api/stock-adjustments?locationId=X` - Adjustments at location

## 🔔 Notifications System

### Notification Types

| Type | Priority | Trigger |
|------|----------|---------|
| **STOCKOUT** | Critical | Product quantity ≤ 0 |
| **LOW_STOCK** | High | Product quantity ≤ reorder level |
| **PENDING_RECEIPT** | Medium | >5 pending receipts |
| **PENDING_DELIVERY** | Medium | >5 pending deliveries |  
| **PENDING_TRANSFER** | Medium | >5 pending transfers |
| **OPERATION_COMPLETED** | Low | Operation validated successfully |

### Automatic Triggers

- **Stock Level Checks**: After every stock movement
- **Operation Completion**: When receipts/deliveries/transfers/adjustments are validated
- **Pending Operations**: Periodic checks every 30 minutes
- **Cleanup**: Old read notifications removed after 30 days

### Notification Endpoints

- `GET /api/notifications` - Get user notifications (paginated)
- `PATCH /api/notifications/:id/read` - Mark notification as read
- `PATCH /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Background Job

The system runs a cron job every 30 minutes to:
1. Check stock levels for all products with reorder rules
2. Count pending operations per warehouse
3. Clean up old read notifications
4. Generate proactive alerts for managers

## 👤 User Profile Management

### Profile Operations

- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/me` - Update profile (name, phone, profile image)
- `PATCH /api/users/me/password` - Change password (requires current password)
- `PATCH /api/users/me/email` - Change email (requires password confirmation)
- `DELETE /api/users/me/profile-image` - Clear profile image

### Profile Fields

```javascript
{
  name: String,           // Display name
  email: String,          // Email address (unique)
  phone: String,          // Phone number (optional)
  role: String,           // User role
  profileImageUrl: String, // Profile image URL (optional)
  isActive: Boolean,      // Account status
  createdAt: Date,
  updatedAt: Date
}
```

## 📊 Dashboard KPIs

### Warehouse-Level Metrics

- **Total Products**: Active products count
- **Total Stock Value**: Sum of (quantity × cost) across all products
- **Low Stock Items**: Products below reorder level
- **Stockout Items**: Products with zero quantity
- **Pending Receipts**: Receipts awaiting validation
- **Pending Deliveries**: Deliveries awaiting validation

### Operations Feed

Unified feed of recent operations across all types:
- `GET /api/operations?warehouseId=X&categoryId=Y`
- Sorted by most recent activity
- Includes operation type, status, and key details

## 📚 API Reference

### Base URL
```
http://localhost:5000/api
```

### Response Format

All responses follow a consistent envelope:

```javascript
// Success
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ }
}

// Error  
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "MACHINE_READABLE_CODE"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing/invalid auth token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Business rule violation |
| 422 | Validation Error | Schema validation failed |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Internal server error |

### Pagination

List endpoints support pagination:

```javascript
// Request
GET /api/products?page=2&limit=20

// Response
{
  "success": true,
  "data": {
    "products": [...],
    "total": 150,
    "page": 2,
    "limit": 20
  }
}
```

### Filtering & Search

Common query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Text search across relevant fields |
| `category` | ObjectId | Filter by category (includes subcategories) |
| `locationId` | ObjectId | Filter by warehouse location |
| `warehouseId` | ObjectId | Filter by warehouse |
| `status` | string | Filter by operation status |
| `dateFrom` | ISO date | Start date filter |
| `dateTo` | ISO date | End date filter |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `sortBy` | string | Sort field |
| `sortOrder` | string | Sort direction (asc/desc) |

## 🗄️ Database Schema

### Core Collections

#### Users
```javascript
{
  name: String,
  email: String, // unique, lowercase
  password: String, // bcrypt hash
  role: String, // admin|inventory_manager|warehouse_staff
  phone: String,
  profileImageUrl: String,
  isActive: Boolean,
  passwordReset: {
    otp: String,
    expiresAt: Date,
    attempts: Number,
    isLocked: Boolean
  }
}
```

#### Products
```javascript
{
  name: String,
  sku: String, // unique, uppercase
  barcode: String,
  category: ObjectId, // ref: Category
  unitOfMeasure: String,
  description: String,
  reorderLevel: Number,
  reorderQuantity: Number,
  isActive: Boolean
}
```

#### Stock Quantities
```javascript
{
  product: ObjectId, // ref: Product
  warehouse: ObjectId, // ref: Warehouse  
  location: ObjectId, // ref: Location
  quantityOnHand: Number,
  quantityAvailable: Number, // onHand - reserved
  quantityReserved: Number,
  lastMovementAt: Date
}
```

#### Stock Ledger
```javascript
{
  product: ObjectId,
  warehouse: ObjectId,
  location: ObjectId,
  movementType: String,
  quantityChange: Number,
  balanceAfter: Number,
  reference: {
    docType: String,
    docId: ObjectId, 
    docNumber: String
  },
  performedBy: ObjectId,
  timestamp: Date
}
```

### Key Indexes

```javascript
// StockQuantity - primary lookup
{ product: 1, warehouse: 1, location: 1 }

// StockLedger - audit trail queries  
{ product: 1, warehouse: 1, location: 1 }
{ timestamp: -1 }

// Products - search and categorization
{ sku: 1 } // unique
{ category: 1 }
{ name: "text", sku: "text", barcode: "text" }

// Operations - status and date queries
{ status: 1, createdAt: -1 }
{ warehouseId: 1, status: 1 }

// Categories - hierarchy queries
{ path: 1 }
{ parentId: 1 }

// Notifications - user queries
{ userId: 1, read: 1, createdAt: -1 }
```

## ⚠️ Error Handling

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `ALREADY_EXISTS` | 409 | Resource already exists |
| `INSUFFICIENT_STOCK` | 409 | Not enough stock available |
| `OPERATION_NOT_ALLOWED` | 409 | Business rule violation |
| `RATE_LIMITED` | 429 | Too many requests |

### Stock Operation Errors

| Code | Description |
|------|-------------|
| `RECEIPT_IMMUTABLE` | Receipt is done/canceled, cannot modify |
| `INSUFFICIENT_STOCK` | Not enough available stock for operation |
| `LOCATION_WAREHOUSE_MISMATCH` | Location doesn't belong to specified warehouse |
| `PRODUCT_INACTIVE` | Cannot operate on inactive product |
| `WAREHOUSE_INACTIVE` | Cannot operate in inactive warehouse |

### Validation Errors

All endpoints validate input using Joi schemas. Validation errors return:

```javascript
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## 🔧 Development

### Running in Development

```bash
# Install dependencies
npm install

# Start with auto-restart
npm run dev

# Run with debugging
DEBUG=* npm start
```

### Testing

```bash
# Run tests (when available)
npm test

# Check for issues
npm audit

# Fix auto-fixable issues
npm audit fix
```

### Code Structure

```
src/
├── config/         # Database and environment config
├── constants/      # App constants and enums
├── controllers/    # Request handlers (empty - routes handle directly)
├── jobs/           # Background job definitions
├── middleware/     # Auth, validation, error handling
├── models/         # Mongoose schemas
├── routes/         # Express route definitions
├── services/       # Business logic layer
├── utils/          # Helper functions
├── validators/     # Joi validation schemas
├── app.js          # Express app setup
└── server.js       # Server entry point
```

## 🚀 Production Deployment

### Environment Setup

1. **MongoDB**: Use MongoDB Atlas or self-hosted replica set
2. **Node.js**: Version 18+ recommended  
3. **Environment**: Set `NODE_ENV=production`
4. **Secrets**: Use strong, unique JWT secrets
5. **Email**: Configure SMTP for OTP delivery

### Security Considerations

- ✅ JWT tokens with short expiration
- ✅ HTTP-only refresh token cookies
- ✅ Password hashing with bcrypt
- ✅ Rate limiting on auth endpoints
- ✅ Input validation on all endpoints
- ✅ Role-based access control
- ✅ Security headers (HSTS, XSS protection)

### Performance Optimizations

- ✅ Database indexes for frequent queries
- ✅ Aggregation pipelines for complex queries
- ✅ Pagination on list endpoints
- ✅ Compound indexes for multi-field queries
- ✅ Background job scheduling
- ✅ Automatic cleanup of old data

### Monitoring

Monitor these key metrics:
- API response times
- Database query performance
- Authentication success/failure rates
- Stock movement accuracy
- Notification delivery
- Background job execution

## 📄 License

This project is licensed under the ISC License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation
- Review the error codes reference

---

**StockSense Backend** - Built with ❤️ for modern inventory management.