# Affiliate Analytics API

## Overview
The Affiliate Analytics API provides comprehensive analytics data for affiliate users, including total clicks, orders, earnings, and pending earnings.

## Endpoint
```
GET /api/affiliate/analytics
```

## Authentication
- **Required**: Yes
- **Type**: Bearer Token
- **Header**: `Authorization: Bearer <access_token>`

## Request
No request body or query parameters required. The user ID is extracted from the authenticated token.

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "totalClicks": 150,
    "totalOrders": 25,
    "totalEarnings": 12500.50,
    "totalPendingEarnings": 2500.75
  }
}
```

### Error Response (400 Bad Request)
```json
{
  "error": "UID not found in token/user"
}
```

### Error Response (500 Internal Server Error)
```json
{
  "success": false,
  "error": "Server error message"
}
```

## Analytics Calculations

### Total Clicks
- **Formula**: `COUNT(cartDetail WHERE referBy = user.uid) + COUNT(order_items WHERE referBy = user.uid)`
- **Description**: Total number of items added to cart or ordered through this affiliate's referral link

### Total Orders
- **Formula**: `COUNT(order_items WHERE referBy = user.uid)`
- **Description**: Total number of order items purchased through this affiliate's referral link

### Total Earnings
- **Formula**: `SUM(amount FROM affiliatePayments WHERE uid = user.uid AND type = 'incoming')`
- **Description**: Total affiliate commission from all incoming payments recorded in affiliatePayments table

### Pending Earnings
- **Formula**: `SUM(amount FROM affiliateTransactions WHERE uid = user.uid AND type = 'incoming' AND status = 'pending')`
- **Description**: Pending affiliate commission from transactions that are still pending (not yet processed)

### Available Payout
- **Formula**: `SUM(amount FROM affiliateTransactions WHERE uid = user.uid AND type = 'incoming' AND status = 'completed')`
- **Description**: Amount available for payout (completed incoming transactions only)

### Requestable Payouts
- **Formula**: Same as Available Payout
- **Description**: Amount that can be requested for payout (completed incoming transactions)

### Total Paid
- **Formula**: `SUM(amount FROM affiliateTransactions WHERE uid = user.uid AND type = 'outgoing' AND status = 'completed')`
- **Description**: Total amount paid out to the affiliate (completed outgoing transactions)

### Requested Payout
- **Formula**: `SUM(amount FROM affiliateTransactions WHERE uid = user.uid AND type = 'outgoing' AND status = 'pending')`
- **Description**: Total amount requested for payout but still pending (pending outgoing transactions)

## Database Tables Used
- `cartDetail` - For tracking cart clicks (centralized referBy)
- `order_items` - For tracking orders
- `orderDetail` - For order status information and buyer details
- `affiliateTransactions` - For tracking earnings, pending payments, and payout requests

## Related APIs

### GET /api/affiliate/orders
Returns detailed order information including buyer UID for orders referred by the affiliate.

**Response includes:**
- `orderID` - Order identifier
- `buyerUID` - UID of the customer who placed the order
- `total` - Total order amount
- `paymentMode` - Payment method used
- `createdAt` - Order creation date
- `orderStatus` - Current order status
- `productID` - Product identifier
- `quantity` - Quantity ordered
- `name` - Product name
- `unitPriceAfter` - Price per unit after discounts
- `lineTotalAfter` - Total line amount after discounts
- `referBy` - Affiliate UID who referred this order

## Example Usage

### JavaScript/Node.js
```javascript
const axios = require('axios');

async function getAffiliateAnalytics() {
  try {
    const response = await axios.get('/api/affiliate/analytics', {
      headers: {
        'Authorization': 'Bearer your_access_token_here'
      }
    });
    
    console.log('Analytics:', response.data.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}
```

### cURL
```bash
curl -X GET "http://72.60.219.181:3002/api/affiliate/analytics" \
  -H "Authorization: Bearer your_access_token_here" \
  -H "Content-Type: application/json"
```

## Notes
- All monetary values are returned as numbers (not strings)
- Zero values are returned as `0` (not `null`)
- The API requires the user to be authenticated and have affiliate permissions
- Analytics are calculated in real-time based on current database state
