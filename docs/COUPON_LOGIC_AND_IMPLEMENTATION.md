# Coupon Implementation Guide (Frontend & Backend)

This document explains how coupons are applied in the Ithyaraa web frontend and how the logic is handled by the backend. Use this as a reference for implementing the same functionality in the Flutter app.

---

## 1. User Workflow

1.  **Input**: The user enters a coupon code in the cart screen.
2.  **Validation**: The frontend sends a POST request to the backend with the code and `cartID`.
3.  **Application**: If valid, the backend returns the discount amount. The frontend stores this in its local state.
4.  **Recalculation**: The frontend subtracts the theoretical discount from the total price displayed to the user.
5.  **Placement**: When placing the order, the `couponCode` is sent along with other order details.

---

## 2. API Reference

### Apply Coupon
- **Endpoint**: `POST /user-coupon/apply-coupon`
- **Authentication**: Required (`Bearer Token`)
- **Request Body**:
  ```json
  {
    "couponCode": "SUMMER50",
    "cartID": 123 // Optional: Backend will find it using UID if not provided
  }
  ```
- **Response (Success)**:
  ```json
  {
    "success": true,
    "couponID": 10,
    "couponCode": "SUMMER50",
    "subtotal": 2500,
    "discount": 250,
    "finalTotal": 2250,
    "eligibleItemsCount": 2,
    "totalItemsCount": 3
  }
  ```
- **Response (Error)**:
  - `400 Bad Request`: Validation errors (e.g., "Minimum order value of ₹500 required", "Coupon already used", "No eligible products").
  - `500 Internal Server Error`: Server issues.

---

## 3. Backend Business Logic

The backend performs several critical checks during the `/apply-coupon` call (see `userCouponsService.js`):

### A. Eligibility Rules
A coupon **cannot** be applied to:
1.  **Combo Products**: Items with `productType === 'combo'` or `'make_combo'`.
2.  **Existing Offers**: Products that already have an `offerID` (active discount/promotion).
3.  **Unselected Items**: Only items "selected" for checkout are considered.

### B. Math Calculations
- **Base Price**: The sum of `lineTotalBefore` for all **eligible** selected items.
- **Discount Types**:
  - `percentage`: `Subtotal * (DiscountValue / 100)`
  - `flat`: `DiscountValue`
- **Cap**: The discount cannot exceed the subtotal of the eligible items.

---

## 4. Frontend State Management (Next.js Example)

In the Flutter app, you should replicate this state logic:

### A. State Variables
- `appliedCoupon`: Stores the full response object from the API.
- `couponDiscount`: Stores the number value of the discount.

### B. Pricing Breakdown
The final price should be calculated as follows (see `breakdownCart.jsx`):
```javascript
// Base Subtotal (from Cart API)
const subtotal = cartDetail.total; 

// Apply Coupon
const finalTotal = subtotal - couponDiscount + handlingFee + shipping;
```

### C. Auto-Reset Logic (Crucial!)
In the web app, if a user removes an item from the cart after a coupon is applied, the coupon is **automatically removed**. This forces the user to re-apply it so the backend can re-validate eligibility (e.g., if the user dropped below the minimum order value).

**Flutter Implementation Tip:** Use a listener or a state observer to watch the cart length. If it decreases, set `couponDiscount = 0` and `appliedCoupon = null`.

---

## 5. Order Execution

When the user clicks "Place Order", send the `couponCode` in the payload:

- **Endpoint**: `POST /order/place-order`
- **Payload Snippet**:
  ```json
  {
    "addressID": 45,
    "paymentMode": "PREPAID",
    "couponCode": "SUMMER50", // Send the actual code here
    "walletApplied": 0
  }
  ```

---

## 6. Error Handling Tips for Flutter

- **Warning vs Error**: If the API returns a `400` status, show it as a **Warning Toast** (user instruction mistake). If it's a `500`, show it as an **Error** (system failure).
- **Loading State**: Disable the total calculation and the "Place Order" button while the `apply-coupon` API is in-flight.
