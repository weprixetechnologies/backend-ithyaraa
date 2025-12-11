-- Migration: Add redeemableAt column to coin_lots table
-- This column tracks when coins become redeemable (7 days after delivery)
-- Coins are credited instantly on delivery but can only be redeemed after 7 days
-- This implements a 7-day return period hold on coin redemption

-- Add redeemableAt column (nullable for backward compatibility)
ALTER TABLE coin_lots 
ADD COLUMN redeemableAt DATETIME NULL AFTER expiresAt;

-- Update existing records: set redeemableAt to earnedAt + 7 days
-- For records where earnedAt exists, add 7 days
UPDATE coin_lots 
SET redeemableAt = DATE_ADD(earnedAt, INTERVAL 7 DAY)
WHERE earnedAt IS NOT NULL AND redeemableAt IS NULL;

-- For records where earnedAt is NULL but createdAt exists, use createdAt + 7 days
UPDATE coin_lots 
SET redeemableAt = DATE_ADD(createdAt, INTERVAL 7 DAY)
WHERE earnedAt IS NULL AND createdAt IS NOT NULL AND redeemableAt IS NULL;

-- For any remaining NULL records, set to current time (immediately redeemable)
-- This handles edge cases where both earnedAt and createdAt might be NULL
UPDATE coin_lots 
SET redeemableAt = NOW()
WHERE redeemableAt IS NULL;

-- Note: The column remains nullable in the schema to handle edge cases,
-- but the application code will always set it when creating new lots.
-- The redemption query handles NULL as "immediately redeemable" for backward compatibility.

