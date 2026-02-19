-- Migration: create product_groups and group_products tables
-- Run this on your MySQL instance (ensure `ithyaraa` database)

CREATE TABLE IF NOT EXISTS `product_groups` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sectionID` INT NOT NULL,
  `orderIndex` INT DEFAULT 0,
  `imageUrl` TEXT,
  `isBannerised` TINYINT(1) DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `group_products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `groupID` INT NOT NULL,
  `productID` BIGINT NOT NULL,
  `position` INT DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_group_product` (`groupID`, `productID`),
  INDEX `idx_groupID` (`groupID`),
  CONSTRAINT `fk_group_products_group` FOREIGN KEY (`groupID`) REFERENCES `product_groups`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

