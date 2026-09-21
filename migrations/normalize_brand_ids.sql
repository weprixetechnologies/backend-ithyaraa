-- Normalize brandID across database tables for in-house admin products
-- Ensures all in-house products, order items, and cart records use 'inhouse' as brandID

UPDATE products 
SET brandID = 'inhouse' 
WHERE brandID IS NULL OR LOWER(brandID) IN ('inhouse', 'in-house', 'admin', '');

UPDATE order_items 
SET brandID = 'inhouse' 
WHERE brandID IS NULL OR LOWER(brandID) IN ('inhouse', 'in-house', 'admin', '');
