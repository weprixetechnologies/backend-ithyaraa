-- Add tracking columns to order_items table
ALTER TABLE ithyaraa.order_items 
ADD COLUMN IF NOT EXISTS trackingCode VARCHAR(100) NULL AFTER referBy,
ADD COLUMN IF NOT EXISTS deliveryCompany VARCHAR(100) NULL AFTER trackingCode,
ADD COLUMN IF NOT EXISTS itemStatus ENUM('pending', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned') DEFAULT 'pending' AFTER deliveryCompany;

