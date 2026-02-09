-- ============================================================================
-- Coupon: per-user usage limit and minimum order value
-- Run after DB is utf8mb4_general_ci. Backward compatible with existing coupons.
-- ============================================================================

-- 1. Add maxUsagePerUser to coupons (NULL = unlimited, 1 = single use, N = N times per user)
ALTER TABLE coupons
ADD COLUMN maxUsagePerUser INT NULL DEFAULT NULL
COMMENT 'Max times this coupon can be used per user; NULL = unlimited'
AFTER usageLimit;

-- 2. Add minOrderValue to coupons (NULL or 0 = no minimum)
ALTER TABLE coupons
ADD COLUMN minOrderValue DECIMAL(10,2) NULL DEFAULT NULL
COMMENT 'Minimum order subtotal (eligible amount) required; NULL = no minimum'
AFTER maxUsagePerUser;

-- 3. Coupon usage tracking per user (one row per order that used the coupon)
-- Ensures we only count successful usage and stay concurrency-safe (unique per order).
CREATE TABLE IF NOT EXISTS coupon_user_usage (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  couponID VARCHAR(255) NOT NULL,
  uid VARCHAR(255) NOT NULL,
  orderID BIGINT UNSIGNED NOT NULL,
  usedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_coupon_order (couponID, orderID),
  KEY idx_coupon_uid (couponID, uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
