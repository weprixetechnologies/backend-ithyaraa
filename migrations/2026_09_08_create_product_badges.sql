-- Migration: Create product_badges and product_badge_mappings tables

CREATE TABLE IF NOT EXISTS `product_badges` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `bgColor` VARCHAR(50) DEFAULT '#ef4444',
  `textColor` VARCHAR(50) DEFAULT '#ffffff',
  `icon` VARCHAR(50) DEFAULT '🔥',
  `isActive` TINYINT(1) DEFAULT 1,
  `displayOrder` INT DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `product_badge_mappings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `badgeID` INT NOT NULL,
  `productID` BIGINT NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_badge_product` (`badgeID`, `productID`),
  INDEX `idx_badgeID` (`badgeID`),
  INDEX `idx_productID` (`productID`),
  CONSTRAINT `fk_badge_mappings_badge` FOREIGN KEY (`badgeID`) REFERENCES `product_badges`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
