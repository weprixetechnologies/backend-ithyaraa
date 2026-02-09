-- Affiliate refer settlement: lock until return period, return handling, and lock amount support
-- Run this migration to add orderID, comment, lockedUntil and new status values ('confirmed', 'returned').

-- 1. Add orderID to link transaction to order (for delivery/return handling)
ALTER TABLE `affiliateTransactions`
  ADD COLUMN `orderID` bigint(20) DEFAULT NULL AFTER `type`,
  ADD KEY `idx_orderID` (`orderID`);

-- 2. Add comment and lockedUntil (7-day return period)
ALTER TABLE `affiliateTransactions`
  ADD COLUMN `comment` text DEFAULT NULL AFTER `orderID`,
  ADD COLUMN `lockedUntil` datetime DEFAULT NULL AFTER `comment`;

-- 3. Extend status enum: pending -> confirmed (on delivery) -> completed (after 7 days) or returned (on return)
ALTER TABLE `affiliateTransactions`
  MODIFY COLUMN `status` enum('pending','confirmed','completed','failed','rejected','returned') NOT NULL DEFAULT 'pending';
