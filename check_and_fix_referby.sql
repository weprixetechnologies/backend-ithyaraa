-- Check current column definition
DESCRIBE cart_items;

-- Fix referBy column to allow NULL values
ALTER TABLE cart_items MODIFY COLUMN referBy VARCHAR(255) NULL;

-- Verify the change
DESCRIBE cart_items;
