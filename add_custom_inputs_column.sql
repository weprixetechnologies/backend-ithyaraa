-- Add custom_inputs column to products table for storing dynamic input field definitions
-- This column will store JSON data defining what input fields customers need to fill
ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_inputs JSON NULL DEFAULT NULL;

-- Add index for better performance when querying custom products
CREATE INDEX IF NOT EXISTS idx_products_custom_inputs ON products(custom_inputs(255));
