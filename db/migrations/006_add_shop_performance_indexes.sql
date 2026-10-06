-- Migration 006: Add performance indexes for shop catalog queries and sorting
-- Improves count queries, status filters, price filters, and pagination

ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_isDeleted` (`isDeleted`);
ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_salePrice` (`salePrice`);
ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_createdAt` (`createdAt`);
ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_status` (`status`(32));
ALTER TABLE `products` ADD INDEX IF NOT EXISTS `idx_products_displayOrder` (`displayOrder`);
