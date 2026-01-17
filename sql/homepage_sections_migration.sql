-- Migration: Add fallbackLink column to homepage_sections table
-- Run this if the table already exists

ALTER TABLE homepage_sections 
ADD COLUMN fallbackLink TEXT NULL COMMENT 'Constructed link: FRONTEND_URL/routeTo?filters' 
AFTER filters;
