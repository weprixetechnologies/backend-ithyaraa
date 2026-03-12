-- Add commissionPercentage column for brand commission logic
-- Nullable, applies only to brand accounts (role = 'brand')

ALTER TABLE `users`
ADD COLUMN `commissionPercentage` DECIMAL(5,2) NULL AFTER `newsletter_joined`;

