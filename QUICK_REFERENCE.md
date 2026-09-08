# PhonePe Integration - Quick Reference Guide

## 🚀 Quick Start

### 1. Environment Setup
```env
MERCHANT_ID=your_merchant_id
KEY=your_salt_key
KEY_INDEX=1
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com
```

### 2. Database Setup
```sql
ALTER TABLE orderDetail 
ADD COLUMN merchantID VARCHAR(100) DEFAULT NULL,
ADD COLUMN paymentStatus VARCHAR(20) DEFAULT 'pending',
ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
```

### 3. Test Payment
```bash
curl -X POST "http://localhost:7885/api/order/place" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"addressID": "test", "paymentMode": "PREPAID"}'
```

## 📡 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/order/place` | Create order and initiate payment |
| POST | `/api/phonepe/webhook` | PhonePe webhook (automatic) |
| GET | `/api/phonepe/status/:merchantID` | Check payment status |
| GET | `/api/phonepe/order/:orderId/status` | Check order payment status |

## 🔄 Payment Flow

1. **Create Order** → `POST /api/order/place`
2. **User Pays** → PhonePe checkout page
3. **Webhook Called** → `POST /api/phonepe/webhook` (automatic)
4. **Database Updated** → Payment status saved
5. **Email Sent** → Confirmation email

## 🛠️ Key Functions

### Order Creation
```javascript
// In orderController.js
const placeOrderController = async (req, res) => {
  // Creates order and initiates PhonePe payment
}
```

### Webhook Handling
```javascript
// In phonepeController.js
const handleWebhookController = async (req, res) => {
  // Processes PhonePe webhook notifications
}
```

### Status Check
```javascript
// In phonepeService.js
const checkPaymentStatus = async (merchantID) => {
  // Checks payment status with PhonePe API
}
```

## 🔧 Troubleshooting

### Webhook Not Working
- Check if server is accessible from internet
- Verify webhook URL in PhonePe dashboard
- Check signature verification

### Database Not Updating
- Verify database columns exist
- Check merchantID is stored
- Check database connection

### Payment Status Issues
- Verify PhonePe credentials
- Check API endpoint URLs
- Check checksum generation

## 📊 Status Mapping

| PhonePe Code | Internal Status | Description |
|--------------|-----------------|-------------|
| `PAYMENT_SUCCESS` | `paid` | Payment successful |
| `PAYMENT_ERROR` | `failed` | Payment failed |
| `PAYMENT_PENDING` | `pending` | Payment pending |

## 🔐 Security

- Always verify webhook signatures
- Use HTTPS in production
- Keep environment variables secure
- Validate all input data

## 📝 Logs to Check

```bash
# Webhook calls
grep "PhonePe webhook received" logs/app.log

# Payment updates
grep "Order status updated" logs/app.log

# Errors
grep "ERROR" logs/app.log
```

## 🎯 Next Steps

1. **Configure Environment Variables**
2. **Run Database Migration**
3. **Test with Sandbox**
4. **Deploy to Production**
5. **Monitor Webhook Calls**

## 📞 Support

- Check logs for error details
- Verify PhonePe dashboard settings
- Test with sandbox environment first
- Monitor webhook delivery success rates
