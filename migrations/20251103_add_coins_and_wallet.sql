-- Ithyaraa Coins (Royalty) and Wallet adjustments

-- 1) Add coinsEarned to orderDetail to persist coins awarded per order
ALTER TABLE orderDetail
    ADD COLUMN IF NOT EXISTS coinsEarned INT NOT NULL DEFAULT 0;

-- 2) Coin lots track earn units with 365-day rolling expiry (FIFO redemption)
CREATE TABLE IF NOT EXISTS coin_lots (
    lotID INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(64) NOT NULL,
    orderID INT NULL,
    coinsTotal INT NOT NULL,
    coinsUsed INT NOT NULL DEFAULT 0,
    coinsExpired INT NOT NULL DEFAULT 0,
    earnedAt DATETIME NOT NULL DEFAULT NOW(),
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT NOW(),
    updatedAt DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    INDEX idx_coin_lots_uid (uid),
    INDEX idx_coin_lots_expires (expiresAt),
    INDEX idx_coin_lots_uid_expires (uid, expiresAt)
);

-- 3) Coin transactions for audit trail (earn, redeem, expire, reversal, pending)
CREATE TABLE IF NOT EXISTS coin_transactions (
    txnID INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(64) NOT NULL,
    type ENUM('earn','redeem','expire','reversal','pending') NOT NULL,
    coins INT NOT NULL,
    refType VARCHAR(32) NULL,
    refID VARCHAR(128) NULL,
    meta JSON NULL,
    createdAt DATETIME NOT NULL DEFAULT NOW(),
    INDEX idx_coin_txn_uid (uid),
    INDEX idx_coin_txn_type (type),
    INDEX idx_coin_txn_ref (refType, refID)
);

-- 4) Denormalized coin balance for fast reads
CREATE TABLE IF NOT EXISTS coin_balance (
    uid VARCHAR(64) PRIMARY KEY,
    balance INT NOT NULL DEFAULT 0,
    updatedAt DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- 5) Ensure users table has wallet balance (if not already present)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS balance DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- 6) Add wallet payment tracking to orderDetail
ALTER TABLE orderDetail
    ADD COLUMN IF NOT EXISTS isWalletUsed TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS paidWallet DECIMAL(12,2) NOT NULL DEFAULT 0.00;


