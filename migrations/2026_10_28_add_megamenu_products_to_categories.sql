-- Add megamenuProducts column to categories table for admin-curated carousel products
ALTER TABLE categories ADD COLUMN IF NOT EXISTS megamenuProducts JSON DEFAULT NULL;
