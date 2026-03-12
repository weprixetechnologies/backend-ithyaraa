-- Replacement as new order, return_initiated status, return AWB fields
-- Run after partial_returns_order_items_and_refund_queries.sql

-- 1) order_items: add return_initiated to returnStatus enum, replacementOrderID, return AWB columns
ALTER TABLE order_items
  MODIFY COLUMN returnStatus ENUM(
    'none',
    'return_requested',
    'return_initiated',
    'replacement_processing',
    'replacement_shipped',
    'returned',
    'refund_pending',
    'refund_completed'
  ) NOT NULL DEFAULT 'none';
ALTER TABLE order_items ADD COLUMN replacementOrderID INT NULL;
ALTER TABLE order_items ADD COLUMN returnTrackingCode VARCHAR(255) NULL;
ALTER TABLE order_items ADD COLUMN returnDeliveryCompany VARCHAR(255) NULL;
ALTER TABLE order_items ADD COLUMN returnTrackingUrl VARCHAR(512) NULL;

-- Index for brand lookups by replacement order
CREATE INDEX idx_order_items_replacement_order ON order_items(replacementOrderID);

-- 2) orderDetail: isReplacement = true only for replacement orders (created from return window)
ALTER TABLE orderDetail ADD COLUMN isReplacement TINYINT(1) NOT NULL DEFAULT 0;
