-- Add order column to categories if not exists
ALTER TABLE categories ADD COLUMN IF NOT EXISTS `order` INT DEFAULT 0;
