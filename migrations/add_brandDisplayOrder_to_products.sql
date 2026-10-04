-- Migration: Add brandDisplayOrder column and index to products table
ALTER TABLE `products` 
ADD COLUMN `brandDisplayOrder` INT DEFAULT 0;

ALTER TABLE `products` 
ADD INDEX `idx_products_brand_display_order` (`brandID`, `brandDisplayOrder`);
