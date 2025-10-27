-- Add GSTIN column to users table
ALTER TABLE users
ADD COLUMN gstin VARCHAR(15) NULL AFTER balance;

