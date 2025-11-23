-- Check current column definition
-- Migration to centralize referBy at cartDetail

-- 1) Add referBy to cartDetail if not exists
ALTER TABLE cartDetail ADD COLUMN IF NOT EXISTS referBy VARCHAR(255) NULL;

-- 2) Backfill referBy from any existing cart_items rows (pick first non-null per cart)
UPDATE cartDetail cd
JOIN (
  SELECT cartID, MAX(referBy) AS referBy
  FROM cart_items
  WHERE referBy IS NOT NULL AND referBy <> ''
  GROUP BY cartID
) ci ON ci.cartID = cd.cartID
SET cd.referBy = ci.referBy
WHERE cd.referBy IS NULL;

-- 3) Drop referBy from cart_items if exists
ALTER TABLE cart_items DROP COLUMN IF EXISTS referBy;
