-- Partial returns: order_items return/coin columns, orderDetail.deliveredAt, refund_queries table
-- Run once. If a column already exists, that ALTER will fail; skip or run remaining statements.

-- 1) order_items: return and coin columns
ALTER TABLE order_items
  ADD COLUMN returnStatus ENUM(
    'none',
    'return_requested',
    'replacement_processing',
    'replacement_shipped',
    'returned',
    'refund_pending',
    'refund_completed'
  ) NOT NULL DEFAULT 'none';
ALTER TABLE order_items ADD COLUMN returnRequestedAt DATETIME NULL;
ALTER TABLE order_items ADD COLUMN replacementOrderItemID VARCHAR(50) NULL;
ALTER TABLE order_items ADD COLUMN refundQueryID VARCHAR(50) NULL;
ALTER TABLE order_items ADD COLUMN earnedCoins INT NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN coinLockUntil DATETIME NULL;
ALTER TABLE order_items ADD COLUMN coinsReversed TINYINT(1) NOT NULL DEFAULT 0;

-- 2) orderDetail: deliveredAt for 7-day return window
ALTER TABLE orderDetail ADD COLUMN deliveredAt DATETIME NULL;

-- 2b) affiliateTransactions: orderItemID and type for return deduction
ALTER TABLE affiliateTransactions ADD COLUMN orderItemID INT NULL;
ALTER TABLE affiliateTransactions MODIFY COLUMN type ENUM('incoming','outgoing','affiliate_return_deduction') NOT NULL;

-- 3) refund_queries table
CREATE TABLE IF NOT EXISTS refund_queries (
  refundQueryID VARCHAR(50) NOT NULL PRIMARY KEY,
  orderID INT NOT NULL,
  orderItemID INT NOT NULL,
  productID VARCHAR(125) NOT NULL,
  userID VARCHAR(125) NOT NULL,
  brandID VARCHAR(100) DEFAULT NULL,
  reason TEXT,
  status ENUM('pending','contacting_customer','resolved') NOT NULL DEFAULT 'pending',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_refund_queries_order (orderID),
  INDEX idx_refund_queries_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
