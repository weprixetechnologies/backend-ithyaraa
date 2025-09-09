# PhonePe Webhook Setup for Next.js

## Overview
This implementation uses PhonePe webhooks to automatically update payment status in the database when payments are completed. Perfect for Next.js applications where server-side redirections don't work well.

## 🔄 How It Works

### 1. **Order Placement**
- User places order with `paymentMode: 'PREPAID'`
- Backend creates order with `paymentStatus: 'pending'`
- User redirected to PhonePe checkout page

### 2. **Payment Processing**
- User pays on PhonePe checkout page
- PhonePe processes the payment

### 3. **Webhook Notification**
- **PhonePe automatically sends webhook** to your backend
- **Backend receives webhook** at `/api/phonepe/webhook`
- **Database updated automatically** with payment status
- **Email sent** if payment successful

### 4. **User Redirected to Frontend**
- User redirected to Next.js frontend: `/payment-status?merchantTransactionId=xxx`
- Frontend can check payment status using the manual API

## 📋 API Endpoints

### Webhook (Automatic)
```http
POST /api/phonepe/webhook
```
- **Purpose**: Receives payment status updates from PhonePe
- **Security**: Signature verified using X-VERIFY header
- **Action**: Updates database and sends emails

### Manual Status Check
```http
GET /api/phonepe/status/:merchantTransactionId
```
- **Purpose**: Check payment status manually
- **Use Case**: Frontend can call this to get current status

### Order Status Check
```http
GET /api/phonepe/order/:orderId/status
```
- **Purpose**: Check payment status by order ID
- **Use Case**: Frontend can check status using order ID

## ⚙️ Setup Instructions

### 1. **Configure PhonePe Webhook**
1. Go to PhonePe Merchant Dashboard
2. Navigate to Webhook Settings
3. Add webhook URL: `https://yourdomain.com/api/phonepe/webhook`
4. Enable webhook notifications

### 2. **Environment Variables**
```env
# PhonePe Configuration
MERCHANT_ID=your_merchant_id
KEY=your_salt_key
KEY_INDEX=1

# Frontend URL (where user gets redirected after payment)
FRONTEND_URL=https://yourdomain.com

# Backend URL (for webhook)
BACKEND_URL=https://yourdomain.com
```

### 3. **Database Schema**
```sql
ALTER TABLE orderDetail 
ADD COLUMN merchantTransactionId VARCHAR(100) DEFAULT NULL AFTER couponDiscount,
ADD COLUMN paymentStatus VARCHAR(20) DEFAULT 'pending' AFTER merchantTransactionId,
ADD COLUMN updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER paymentStatus;
```

## 🔧 Frontend Integration (Next.js)

### Payment Status Page
Create a page at `/payment-status` in your Next.js app:

```javascript
// pages/payment-status.js or app/payment-status/page.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function PaymentStatus() {
  const router = useRouter();
  const { merchantTransactionId } = router.query;
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (merchantTransactionId) {
      checkPaymentStatus();
    }
  }, [merchantTransactionId]);

  const checkPaymentStatus = async () => {
    try {
      const response = await fetch(`/api/phonepe/status/${merchantTransactionId}`);
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Checking payment status...</div>;

  return (
    <div>
      <h1>Payment Status</h1>
      {status?.orderStatus === 'paid' && (
        <div className="success">
          <h2>Payment Successful!</h2>
          <p>Your order has been confirmed.</p>
        </div>
      )}
      {status?.orderStatus === 'failed' && (
        <div className="error">
          <h2>Payment Failed</h2>
          <p>Please try again.</p>
        </div>
      )}
      {status?.orderStatus === 'pending' && (
        <div className="pending">
          <h2>Payment Pending</h2>
          <p>Please wait while we process your payment.</p>
        </div>
      )}
    </div>
  );
}
```

### API Route for Frontend
Create an API route in Next.js to proxy the status check:

```javascript
// pages/api/phonepe/status/[merchantTransactionId].js
export default async function handler(req, res) {
  const { merchantTransactionId } = req.query;
  
  try {
    const response = await fetch(`${process.env.BACKEND_URL}/api/phonepe/status/${merchantTransactionId}`);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error checking payment status' });
  }
}
```

## 🛡️ Security Features

### Webhook Security
- **Signature Verification**: Validates X-VERIFY header from PhonePe
- **Request Validation**: Ensures data integrity
- **Error Handling**: Comprehensive error logging

### Rate Limiting
- **NPCI Compliance**: Respects PhonePe's rate limits
- **Error Handling**: Graceful handling of API failures

## 📊 Status Mapping

| PhonePe Status | Database Status | Description |
|----------------|-----------------|-------------|
| `PAYMENT_SUCCESS` | `paid` | Payment successful |
| `PAYMENT_ERROR` | `failed` | Payment failed |
| `PAYMENT_PENDING` | `pending` | Payment pending |
| `TRANSACTION_NOT_FOUND` | `not_found` | Transaction not found |
| `TIMED_OUT` | `timeout` | Payment timed out |

## 🔍 Testing

### Test Webhook
```bash
# Test webhook endpoint
curl -X POST "https://yourdomain.com/api/phonepe/webhook" \
  -H "Content-Type: application/json" \
  -H "X-VERIFY: your_signature" \
  -d '{"merchantTransactionId":"test123","code":"PAYMENT_SUCCESS"}'
```

### Test Status Check
```bash
# Test manual status check
curl -X GET "https://yourdomain.com/api/phonepe/status/merchant-transaction-id"
```

## ✅ Benefits

- **Real-time Updates**: Instant database updates via webhooks
- **Next.js Compatible**: No server-side redirection issues
- **Reliable**: PhonePe handles the webhook delivery
- **Secure**: Signature verification ensures authenticity
- **Automatic**: No manual intervention required

This webhook-based approach is perfect for Next.js applications and provides reliable, real-time payment status updates!
