-- Migration: Add dressTypes to products table
ALTER TABLE products ADD COLUMN dressTypes JSON DEFAULT NULL AFTER custom_inputs;
