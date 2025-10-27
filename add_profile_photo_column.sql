-- Add profilePhoto column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS profilePhoto VARCHAR(500) DEFAULT '';
