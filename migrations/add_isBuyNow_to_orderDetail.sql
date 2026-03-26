-- Add isBuyNow column to orderDetail to distinguish from cart orders
ALTER TABLE orderDetail ADD COLUMN isBuyNow TINYINT(1) NOT NULL DEFAULT 0;
