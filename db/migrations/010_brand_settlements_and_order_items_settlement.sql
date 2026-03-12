-- 010_brand_settlements_and_order_items_settlement.sql
-- Creates brand_settlements table and settlement columns on order_items

CREATE TABLE IF NOT EXISTS brand_settlements (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  brandID              VARCHAR(100) NOT NULL,
  settlementMonth      VARCHAR(7) NOT NULL,        -- format: 'YYYY-MM'
  periodStart          DATE NOT NULL,              -- first day of month
  periodEnd            DATE NOT NULL,              -- last day of month
  grossAmount          DECIMAL(12,2) DEFAULT 0,
  commissionPercentage DECIMAL(5,2) DEFAULT 0,
  commissionAmount     DECIMAL(12,2) DEFAULT 0,
  netAmount            DECIMAL(12,2) DEFAULT 0,
  itemCount            INT DEFAULT 0,              -- how many order_items included
  status               ENUM(
                         'draft',                  -- computed, not yet sent to admin
                         'pending_approval',       -- sent to admin for review
                         'approved',               -- admin approved, ready to pay
                         'paid',                   -- payment transferred
                         'disputed'                -- brand raised a dispute
                       ) DEFAULT 'draft',
  notes                TEXT DEFAULT NULL,
  createdAt            DATETIME DEFAULT NOW(),
  approvedAt           DATETIME DEFAULT NULL,
  paidAt               DATETIME DEFAULT NULL,
  INDEX idx_brand      (brandID),
  INDEX idx_month      (settlementMonth),
  UNIQUE KEY unique_brand_month (brandID, settlementMonth)
);

-- Add settlement tracking columns to order_items if they don't already exist
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS settlementID INT NULL,
  ADD COLUMN IF NOT EXISTS settlementStatus ENUM('unsettled','included','deducted','carried_forward') DEFAULT 'unsettled',
  ADD INDEX IF NOT EXISTS idx_settlement (settlementID),
  ADD INDEX IF NOT EXISTS idx_settlementStatus (settlementStatus);

