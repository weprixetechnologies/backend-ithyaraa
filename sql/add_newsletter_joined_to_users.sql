-- Add newsletter_joined flag to users table for newsletter optimization

ALTER TABLE `users`
ADD COLUMN `newsletter_joined` TINYINT(1) NOT NULL DEFAULT 0 AFTER `affiliate`;

