# Coupon: Per-User Usage Limit & Minimum Order Value

## 1. Verification summary of existing coupon system

- **Tables:** `coupons` (couponID, couponCode, discountType, discountValue, couponUsage, usageLimit, createdAt, updatedAt, assignedUser).
- **Flow:** User applies coupon in cart → `userCouponsController.applyCoupon` → `userCouponsService.applyCouponToCart`. At checkout → `orderController.placeOrderController` → `orderService.placeOrder` → `validateAndApplyCoupon`; order created → previously global `incrementCouponUsage(couponCode)`.
- **Architecture:** Model (`couponsModel`, `userCouponsModel`) → Service (`couponsService`, `userCouponsService`, `orderService`) → Controller. No DB in controllers.
- **Existing checks:** Global `usageLimit` vs `couponUsage`; eligible items (no offer, not combo); discount cap to subtotal. Order service already had a check for `coupon.minimumOrderValue` (code expected a column that did not exist; now implemented as `minOrderValue`).

---

## 2. Required DB changes (SQL)

**Migration file:** `backend/migrations/coupon_per_user_and_min_order.sql`

- `coupons.maxUsagePerUser` INT NULL — NULL = unlimited, 1 = single use per user, N = N times per user.
- `coupons.minOrderValue` DECIMAL(10,2) NULL — minimum eligible subtotal; NULL = no minimum.
- New table `coupon_user_usage`: `(id, couponID, uid, orderID, usedAt)` with UNIQUE(couponID, orderID) for idempotent recording and INDEX(couponID, uid) for per-user count.

**Apply migration:**

```bash
mysql -u ... -p your_db < backend/migrations/coupon_per_user_and_min_order.sql
```

---

## 3. Backend validation logic (step-by-step)

### Apply coupon to cart (userCouponsService.applyCouponToCart)

1. Load cart and restrict to selected items; compute eligible subtotal (no offer, not combo).
2. Load coupon by code with global limit: `usageLimit IS NULL OR couponUsage < usageLimit`.
3. **Min order:** If `coupon.minOrderValue` is set and subtotal < minOrderValue → throw (400).
4. **Per-user limit:** If `uid` present and `coupon.maxUsagePerUser` is set, get `getCouponUsageCountByUser(couponID, uid)`; if count >= maxUsagePerUser → throw (400).
5. Compute discount (percentage/flat), cap to subtotal, return result.

### Place order (orderService.validateAndApplyCoupon)

1. Load coupon by code with global limit (same as above).
2. **Per-user limit:** If `uid` and `coupon.maxUsagePerUser` set, get usage count; if count >= maxUsagePerUser → return failure.
3. Compute eligible subtotal from cart items.
4. **Min order:** If `coupon.minOrderValue` set and subtotal < minOrderValue → return failure.
5. Compute discount and return success + discount.

### When usage is recorded (safe increment)

- **COD / FULL_COIN:** In `orderService.placeOrder`, after `createOrder`, call `couponsModel.recordCouponUsageForOrder(couponCode, uid, orderID)` (replaces old `incrementCouponUsage`).
- **PREPAID:** Not recorded at place order (order is created with paymentStatus = pending). When PhonePe webhook sets payment to successful, `handleRegularOrderWebhook` calls `recordCouponUsageForOrder(order.couponCode, order.uid, order.orderID)`.

---

## 4. Safe usage increment logic

- **recordCouponUsageForOrder(couponCode, uid, orderID)** in `couponsModel`:
  - Runs in a transaction.
  - Resolves couponID from couponCode.
  - `INSERT IGNORE INTO coupon_user_usage (couponID, uid, orderID)` — one row per order; duplicate orderID is ignored.
  - If insert affectedRows === 1, then `UPDATE coupons SET couponUsage = couponUsage + 1 WHERE couponCode = ?`.
  - Commit. So: idempotent per order, no double-count on webhook retries; concurrency-safe.

---

## 5. Admin-side changes

- **Create coupon:** API already accepts optional `maxUsagePerUser` and `minOrderValue` in body (no new required fields). Admin UI should add:
  - **Max use per user:** number input (empty = unlimited, 1 = single use, 2+ = multiple use).
  - **Min order value:** number input (empty = no minimum, else ₹ value).
- **Edit coupon:** PATCH body can include `maxUsagePerUser` and `minOrderValue`; list/detail responses will return these after migration.

---

## 6. Edge cases

| Case | Handling |
|------|----------|
| Guest users | Apply-coupon and place-order require auth (uid present). Per-user check skipped if uid null. |
| Parallel usage | One row per (couponID, orderID). Same order cannot be recorded twice (INSERT IGNORE). Global increment only when insert succeeds. |
| Order / payment failure | COD: usage recorded only after successful createOrder. PREPAID: usage recorded only in webhook when payment status = successful. |
| Coupon expiry / deactivation | No expiry column in current schema; optional future. Deactivation can be handled by a status column (not in this scope). |
| Unlimited per user | `maxUsagePerUser` NULL = unlimited; no check. |
| Backward compatibility | Existing coupons: maxUsagePerUser NULL, minOrderValue NULL → same behaviour as before. |

---

## 7. Final checklist

- [ ] Run migration `coupon_per_user_and_min_order.sql` on the target database.
- [ ] COD order with coupon: after place order, one row in `coupon_user_usage` and `coupons.couponUsage` incremented.
- [ ] PREPAID order with coupon: no usage row at place order; after webhook success, one row in `coupon_user_usage` and `coupons.couponUsage` incremented.
- [ ] Coupon with `minOrderValue`: apply and place order fail when eligible subtotal < minOrderValue (cart and order validation).
- [ ] Coupon with `maxUsagePerUser = 1`: same user second use (cart apply or place order) fails with “maximum number of times”.
- [ ] Admin create/update coupon with `maxUsagePerUser` and `minOrderValue`; list/detail return these fields.
- [ ] Webhook retry: calling `recordCouponUsageForOrder` again for same order does not double-increment (idempotent).
