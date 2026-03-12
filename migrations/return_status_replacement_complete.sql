-- Add replacement_complete after replacement_shipped
-- Run after return_status_return_picked.sql

ALTER TABLE order_items
  MODIFY COLUMN returnStatus ENUM(
    'none',
    'return_requested',
    'return_initiated',
    'return_picked',
    'replacement_processing',
    'replacement_shipped',
    'replacement_complete',
    'returned',
    'refund_pending',
    'refund_completed',
    'returnRejected'
  ) NOT NULL DEFAULT 'none';
