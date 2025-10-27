-- Add custom_inputs column to order_items table
ALTER TABLE order_items 
ADD COLUMN custom_inputs TEXT NULL AFTER referBy;

-- This column will store JSON string of custom product inputs
-- It stores the same custom product data that was in the cart

