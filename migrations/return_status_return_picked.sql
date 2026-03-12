-- Add return_picked to returnStatus enum (between return_initiated and returned)
-- Run after replacement_order_and_return_awb.sql

ALTER TABLE order_items
  MODIFY COLUMN returnStatus ENUM(
    'none',
    'return_requested',
    'return_initiated',
    'return_picked',
    'replacement_processing',
    'replacement_shipped',
    'returned',
    'refund_pending',
    'refund_completed'
  ) NOT NULL DEFAULT 'none';
