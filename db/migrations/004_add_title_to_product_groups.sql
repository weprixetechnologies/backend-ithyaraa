-- Migration: add title column to product_groups
ALTER TABLE product_groups
  ADD COLUMN title VARCHAR(255) NULL AFTER sectionID;

