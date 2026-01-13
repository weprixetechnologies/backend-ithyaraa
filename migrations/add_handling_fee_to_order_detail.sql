-- Add handling fee columns to orderDetail table
ALTER TABLE orderDetail 
ADD COLUMN handlingFee TINYINT(1) DEFAULT 0 AFTER paidWallet,
ADD COLUMN handFeeRate DECIMAL(10,2) DEFAULT 0.00 AFTER handlingFee;

