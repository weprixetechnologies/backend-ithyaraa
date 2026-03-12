-- 011_settlement_payments_and_carry_forward.sql
-- Extends brand_settlements with carry-forward/payment fields
-- and introduces settlement_payments for recording payments.

-- 1. Extend brand_settlements with missing financial columns
ALTER TABLE brand_settlements
  ADD COLUMN carriedForwardAmount  DECIMAL(12,2) DEFAULT 0 AFTER netAmount,
  ADD COLUMN holdReleasedAmount    DECIMAL(12,2) DEFAULT 0 AFTER carriedForwardAmount,
  ADD COLUMN totalPayable          DECIMAL(12,2) DEFAULT 0 AFTER holdReleasedAmount,
  ADD COLUMN amountPaid            DECIMAL(12,2) DEFAULT 0 AFTER totalPayable,
  ADD COLUMN balanceDue            DECIMAL(12,2) DEFAULT 0 AFTER amountPaid,
  ADD COLUMN generatedBy           INT NULL AFTER balanceDue,
  ADD COLUMN settledBy             INT NULL AFTER generatedBy,
  ADD COLUMN settledAt             DATETIME NULL AFTER settledBy;

-- 2. Extend status ENUM to cover partial payments and on-hold
ALTER TABLE brand_settlements
  MODIFY COLUMN status ENUM(
    'draft',
    'pending_approval',
    'approved',
    'partially_paid',
    'paid',
    'disputed',
    'on_hold'
  ) DEFAULT 'draft';

-- 3. New settlement_payments table (PaymentRecord)
CREATE TABLE IF NOT EXISTS settlement_payments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  settlementID    INT NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  paymentMode     ENUM('bank_transfer','upi','cheque','adjustment','other') NOT NULL,
  utrReference    VARCHAR(100) NULL,
  paymentDate     DATE NOT NULL,
  remarks         TEXT NULL,
  recordedBy      INT NOT NULL,
  createdAt       DATETIME DEFAULT NOW(),
  CONSTRAINT fk_settlement_payments_settlement
    FOREIGN KEY (settlementID) REFERENCES brand_settlements(id)
      ON DELETE CASCADE
      ON UPDATE CASCADE
);

-- 4. Track items that were previously carried forward (for hold release reporting)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS wasCarriedForward TINYINT(1) DEFAULT 0 AFTER settlementStatus;

