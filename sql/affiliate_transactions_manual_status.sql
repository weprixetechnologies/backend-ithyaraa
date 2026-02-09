-- Manual affiliate transaction statuses (mPending, mCompleted, etc.) for admin edits. Frontend strips "m" and shows as pending, completed, etc.
-- Run after affiliate_transactions_lock_return.sql if that was applied (status already has confirmed, returned).
-- If your current enum is ('pending','completed','failed','rejected') only, use the second ALTER.

-- Option A: If you already have ('pending','confirmed','completed','failed','rejected','returned')
ALTER TABLE `affiliateTransactions`
  MODIFY COLUMN `status` enum(
    'pending','confirmed','completed','failed','rejected','returned',
    'mPending','mConfirmed','mCompleted','mFailed','mRejected','mReturned'
  ) NOT NULL DEFAULT 'pending';

-- Option B: If you only have ('pending','completed','failed','rejected') - uncomment and run instead:
-- ALTER TABLE `affiliateTransactions`
--   MODIFY COLUMN `status` enum(
--     'pending','completed','failed','rejected','confirmed','returned',
--     'mPending','mConfirmed','mCompleted','mFailed','mRejected','mReturned'
--   ) NOT NULL DEFAULT 'pending';
