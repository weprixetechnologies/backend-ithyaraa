-- Add 'pending' to coin_transactions.type enum
-- Note: If the table already exists without 'pending', we need to modify the enum

-- Check if 'pending' already exists in the enum (MySQL doesn't have direct way to add to enum)
-- If running this on existing database, use ALTER TABLE to modify enum

ALTER TABLE coin_transactions 
MODIFY COLUMN type ENUM('earn','redeem','expire','reversal','pending') NOT NULL;

-- Add index for refType and refID if not exists
CREATE INDEX IF NOT EXISTS idx_coin_txn_ref ON coin_transactions(refType, refID);

