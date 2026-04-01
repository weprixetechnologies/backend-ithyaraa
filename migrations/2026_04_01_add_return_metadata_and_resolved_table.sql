-- Add Return Metadata Columns and Resolved Queries Archive Table
-- Target DB: ithyaraa
-- Tables: order_items, refund_queries, refund_queries_resolved

-- 1. order_items: metadata and approval statuses
ALTER TABLE order_items 
  ADD COLUMN returnType ENUM('refund', 'replacement') DEFAULT NULL,
  ADD COLUMN returnReason TEXT DEFAULT NULL,
  ADD COLUMN returnComments TEXT DEFAULT NULL,
  ADD COLUMN returnPhotos TEXT DEFAULT NULL;

ALTER TABLE order_items
  MODIFY COLUMN returnStatus ENUM(
    'none',
    'return_approval',
    'refund_approval',
    'replacement_approval',
    'return_requested',
    'return_initiated',
    'return_picked',
    'replacement_processing',
    'replacement_shipped',
    'replacement_complete',
    'returned',
    'refund_pending',
    'refund_completed',
    'returnRejected'
  ) NOT NULL DEFAULT 'none';

-- 2. refund_queries: missing columns from JS creation logic
ALTER TABLE refund_queries
  ADD COLUMN returnType ENUM('refund', 'replacement') DEFAULT 'refund' AFTER reason,
  ADD COLUMN comments TEXT DEFAULT NULL,
  ADD COLUMN photos TEXT DEFAULT NULL;

-- 3. refund_queries_resolved archive table
CREATE TABLE IF NOT EXISTS refund_queries_resolved (
    refundQueryID VARCHAR(50) NOT NULL PRIMARY KEY,
    orderID INT NOT NULL,
    orderItemID INT NOT NULL,
    productID VARCHAR(125) NOT NULL,
    userID VARCHAR(125) NOT NULL,
    brandID VARCHAR(100) DEFAULT NULL,
    reason TEXT,
    returnType ENUM('refund', 'replacement') DEFAULT 'refund',
    comments TEXT,
    photos TEXT,
    status ENUM('approved', 'rejected') NOT NULL,
    createdAt DATETIME DEFAULT NULL,
    resolvedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_resolved_order (orderID),
    INDEX idx_resolved_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
