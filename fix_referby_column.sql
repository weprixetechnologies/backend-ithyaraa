-- Fix referBy column to allow NULL values
-- Run this if you're getting "Column 'referBy' cannot be null" error

ALTER TABLE cart_items MODIFY COLUMN referBy VARCHAR(255) NULL;
