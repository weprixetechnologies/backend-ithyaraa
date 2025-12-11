# PhonePe Payment Gateway Integration - Complete Documentation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [API Endpoints](#api-endpoints)
5. [Database Schema](#database-schema)
6. [Code Structure](#code-structure)
7. [Payment Flow](#payment-flow)
8. [Webhook Handling](#webhook-handling)
9. [Error Handling](#error-handling)
10. [Testing](#testing)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)

## 🎯 Overview

This implementation provides a complete PhonePe payment gateway integration for your e-commerce backend with the following features:

- **Order Management**: Create orders with address and coupon support
- **Payment Processing**: PhonePe payment gateway integration
- **Webhook Support**: Real-time payment status updates
- **Email Notifications**: Automatic payment confirmation emails
- **Manual Status Checks**: API endpoints for payment verification
- **Next.js Compatible**: Perfect for modern frontend applications

## 🏗️ Architecture

```
Frontend (Next.js) → Backend API → PhonePe Gateway
                        ↓
                   Database (MySQL)
                        ↓
                   Email Service
```

### Components:
- **Order Controller**: Handles order creation and payment initiation
- **PhonePe Controller**: Manages webhook and status check endpoints
- **PhonePe Service**: Core PhonePe API integration logic
- **Order Model**: Database operations for orders
- **Email Service**: Payment confirmation emails

## ⚙️ Setup Instructions

### 1. Environment Variables

Create a `.env` file with the following variables:

```env
# PhonePe Configuration
MERCHANT_ID=your_merchant_id
KEY=your_salt_key
KEY_INDEX=1

# Application URLs
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com

# Database Configuration
DB_HOST=192.168.1.12
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database

# Node Environment
NODE_ENV=production

# Email Configuration (if using email service)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 2. Database Schema

Run the following SQL to add required columns to your `orderDetail` table:

```sql
-- Add payment-related columns to orderDetail table
ALTER TABLE orderDetail 
ADD COLUMN merchantID VARCHAR(100) DEFAULT NULL AFTER couponDiscount,
ADD COLUMN paymentStatus VARCHAR(20) DEFAULT 'pending' AFTER merchantID,
ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER paymentStatus;

-- Add index for better performance
CREATE INDEX idx_merchant_transaction_id ON orderDetail(merchantID);
CREATE INDEX idx_payment_status ON orderDetail(paymentStatus);
```

### 3. Install Dependencies

```bash
npm install node-fetch crypto express
```

## 📡 API Endpoints

### Order Management

#### Create Order
```http
POST /api/order/place
Content-Type: application/json
Authorization: Bearer <token>

{
  "addressID": "address_123",
  "paymentMode": "PREPAID",
  "couponCode": "SAVE10" // optional
}
```

**Response:**
```json
{
  "success": true,
  "paymentMode": "PREPAID",
  "orderID": 123,
  "merchantOrderId": "uuid-123",
  "checkoutPageUrl": "https://mercury-uat.phonepe.com/..."
}
```

### PhonePe Integration

#### Webhook Endpoint
```http
POST /api/phonepe/webhook
Content-Type: application/json
X-VERIFY: <signature>

{
  "merchantID": "uuid-123",
  "code": "PAYMENT_SUCCESS",
  "state": "COMPLETED",
  "amount": 10000
}
```

#### Manual Status Check
```http
GET /api/phonepe/status/:merchantID
```

**Response:**
```json
{
  "success": true,
  "merchantID": "uuid-123",
  "status": {
    "orderStatus": "paid",
    "isSuccess": true,
    "statusMessage": "Payment successful"
  }
}
```

#### Order Status Check
```http
GET /api/phonepe/order/:orderId/status
```

## 🗄️ Database Schema

### orderDetail Table Structure

```sql
CREATE TABLE orderDetail (
  orderID INT PRIMARY KEY AUTO_INCREMENT,
  uid VARCHAR(50) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  totalDiscount DECIMAL(10,2) DEFAULT 0.00,
  modified TINYINT(1) DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- New payment-related columns
  addressID VARCHAR(50) NOT NULL,
  paymentMode VARCHAR(50) NOT NULL DEFAULT 'cod',
  trackingID VARCHAR(100) DEFAULT NULL,
  deliveryCompany VARCHAR(100) DEFAULT NULL,
  couponCode VARCHAR(50) DEFAULT NULL,
  couponDiscount DECIMAL(10,2) DEFAULT 0.00,
  merchantID VARCHAR(100) DEFAULT NULL,
  paymentStatus VARCHAR(20) DEFAULT 'pending',
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 📁 Code Structure

```
backend/
├── controllers/
│   ├── orderController.js          # Order creation and payment initiation
│   └── phonepeController.js        # Webhook and status check handling
├── services/
│   ├── orderService.js             # Order business logic
│   └── phonepeService.js           # PhonePe API integration
├── model/
│   └── orderModel.js               # Database operations
├── router/
│   └── phonepeRouter.js            # PhonePe API routes
├── templates/
│   └── payment-confirmation.html   # Email template
└── index.js                        # Main application file
```

### Key Files:

#### 1. `controllers/orderController.js`
- **placeOrderController**: Creates orders and initiates PhonePe payments
- **sendOrderConfirmationEmail**: Sends order confirmation emails
- **generateChecksum**: Creates PhonePe API checksums

#### 2. `controllers/phonepeController.js`
- **handleWebhookController**: Processes PhonePe webhook notifications
- **checkPaymentStatusController**: Manual payment status checks
- **getOrderPaymentStatusController**: Order-based status checks

#### 3. `services/phonepeService.js`
- **checkPaymentStatus**: Calls PhonePe status API
- **verifyWebhookSignature**: Validates webhook authenticity
- **processPaymentStatus**: Maps PhonePe status to internal status

#### 4. `model/orderModel.js`
- **createOrder**: Creates new orders with payment details
- **updateOrderPaymentStatus**: Updates payment status
- **addmerchantID**: Stores PhonePe transaction ID

## 🔄 Payment Flow

### 1. Order Creation
```javascript
// User places order
POST /api/order/place
{
  "addressID": "addr_123",
  "paymentMode": "PREPAID",
  "couponCode": "SAVE10"
}
```

### 2. Payment Initiation
```javascript
// Backend creates PhonePe payment request
const payload = {
  merchantId: "MERCHANT_ID",
  merchantID: "uuid-123",
  amount: 10000, // in paise
  redirectUrl: "https://frontend.com/payment-status",
  callbackUrl: "https://backend.com/api/phonepe/webhook",
  redirectMode: "REDIRECT",
  paymentInstrument: { type: "PAY_PAGE" }
};
```

### 3. User Payment
- User redirected to PhonePe checkout page
- User completes payment on PhonePe

### 4. Webhook Notification
```javascript
// PhonePe calls webhook automatically
POST /api/phonepe/webhook
{
  "merchantID": "uuid-123",
  "code": "PAYMENT_SUCCESS",
  "state": "COMPLETED"
}
```

### 5. Database Update
```javascript
// Backend updates order status
await orderModel.updateOrderPaymentStatus(
  merchantID, 
  'paid'
);
```

### 6. Email Notification
```javascript
// Send confirmation email
await sendPaymentConfirmationEmail(merchantID);
```

## 🔗 Webhook Handling

### Webhook Security
```javascript
// Verify PhonePe signature
const isValidSignature = phonepeService.verifyWebhookSignature(
  req.headers['x-verify'], 
  JSON.stringify(req.body)
);
```

### Status Processing
```javascript
// Map PhonePe status to internal status
switch (code) {
  case 'PAYMENT_SUCCESS':
    orderStatus = 'paid';
    isSuccess = true;
    break;
  case 'PAYMENT_ERROR':
    orderStatus = 'failed';
    isSuccess = false;
    break;
  // ... other cases
}
```

### Database Update
```javascript
// Update order status
await orderModel.updateOrderPaymentStatus(
  webhookData.merchantID,
  processedStatus.orderStatus
);
```

## ⚠️ Error Handling

### Payment Errors
```javascript
// Handle payment failures
if (processedStatus.orderStatus === 'failed') {
  console.log(`Payment failed for order ${order.orderID}`);
  // Handle failed payment logic
}
```

### Webhook Errors
```javascript
// Handle webhook processing errors
try {
  await processWebhook(webhookData);
} catch (error) {
  console.error('Webhook processing error:', error);
  return res.status(500).json({
    success: false,
    message: 'Webhook processing failed'
  });
}
```

### API Errors
```javascript
// Handle PhonePe API errors
if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
}
```

## 🧪 Testing

### 1. Test Order Creation
```bash
curl -X POST "http://localhost:3000/api/order/place" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "addressID": "test_address",
    "paymentMode": "PREPAID"
  }'
```

### 2. Test Webhook
```bash
curl -X POST "http://localhost:3000/api/phonepe/webhook" \
  -H "Content-Type: application/json" \
  -H "X-VERIFY: <signature>" \
  -d '{
    "merchantID": "test-123",
    "code": "PAYMENT_SUCCESS"
  }'
```

### 3. Test Status Check
```bash
curl -X GET "http://localhost:3000/api/phonepe/status/test-123"
```

## 🚀 Deployment

### 1. Production Environment Variables
```env
NODE_ENV=production
MERCHANT_ID=your_production_merchant_id
KEY=your_production_salt_key
KEY_INDEX=1
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com
```

### 2. Database Migration
```sql
-- Run the schema update SQL
ALTER TABLE orderDetail 
ADD COLUMN merchantID VARCHAR(100) DEFAULT NULL,
ADD COLUMN paymentStatus VARCHAR(20) DEFAULT 'pending',
ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
```

### 3. Server Configuration
- Ensure your server is accessible from the internet
- Configure SSL/HTTPS for webhook endpoints
- Set up proper logging and monitoring

## 🔧 Troubleshooting

### Common Issues

#### 1. Webhook Not Receiving Calls
**Symptoms**: Payment completes but database not updated
**Solutions**:
- Check if server is accessible from internet
- Verify webhook URL in PhonePe dashboard
- Check server logs for webhook calls

#### 2. Signature Verification Fails
**Symptoms**: Webhook returns 401 Unauthorized
**Solutions**:
- Verify KEY and KEY_INDEX environment variables
- Check signature generation logic
- Ensure raw body parsing is correct

#### 3. Database Update Fails
**Symptoms**: Webhook received but order status not updated
**Solutions**:
- Check database connection
- Verify merchantID exists in database
- Check database column names and types

#### 4. Email Not Sending
**Symptoms**: Payment successful but no email received
**Solutions**:
- Check email service configuration
- Verify email template exists
- Check email service logs

### Debug Commands

```bash
# Check webhook endpoint
curl -X POST "https://yourdomain.com/api/phonepe/webhook" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Check order status
curl -X GET "https://yourdomain.com/api/phonepe/order/123/status"

# Check payment status
curl -X GET "https://yourdomain.com/api/phonepe/status/merchant-txn-id"
```

### Logs to Monitor

```bash
# Webhook logs
grep "PhonePe webhook received" logs/app.log

# Payment status logs
grep "Order status updated" logs/app.log

# Error logs
grep "ERROR" logs/app.log
```

## 📊 Status Codes

### PhonePe Status Codes
| Code | Description | Internal Status |
|------|-------------|-----------------|
| `PAYMENT_SUCCESS` | Payment successful | `paid` |
| `PAYMENT_ERROR` | Payment failed | `failed` |
| `PAYMENT_PENDING` | Payment pending | `pending` |
| `TRANSACTION_NOT_FOUND` | Transaction not found | `not_found` |
| `TIMED_OUT` | Payment timed out | `timeout` |

### HTTP Status Codes
| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized (Invalid signature) |
| 404 | Not Found |
| 500 | Internal Server Error |

## 🔐 Security Considerations

1. **Webhook Signature Verification**: Always verify X-VERIFY header
2. **Environment Variables**: Keep sensitive keys secure
3. **HTTPS**: Use SSL/TLS for all endpoints
4. **Input Validation**: Validate all incoming data
5. **Rate Limiting**: Implement rate limiting for API endpoints
6. **Logging**: Log all webhook calls and errors

## 📈 Performance Considerations

1. **Database Indexing**: Add indexes on frequently queried columns
2. **Connection Pooling**: Use database connection pooling
3. **Error Handling**: Implement proper error handling and retries
4. **Monitoring**: Set up monitoring for webhook success rates
5. **Caching**: Consider caching for frequently accessed data

## 🎯 Best Practices

1. **Idempotency**: Make webhook handlers idempotent
2. **Error Recovery**: Implement retry mechanisms for failed operations
3. **Logging**: Log all important events and errors
4. **Testing**: Test webhook handling thoroughly
5. **Monitoring**: Monitor payment success rates and webhook delivery

This documentation covers your complete PhonePe integration. The system is production-ready and follows best practices for payment gateway integration.
