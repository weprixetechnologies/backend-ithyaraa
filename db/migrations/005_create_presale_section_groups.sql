-- Run this on your MySQL instance (ensure ithyaraa database)

CREATE TABLE IF NOT EXISTS `presale_section_groups` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sectionID` INT NOT NULL,
  `title` VARCHAR(255) NULL,
  `orderIndex` INT DEFAULT 0,
  `imageUrl` TEXT NULL,
  `isBannerised` TINYINT(1) DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `presale_section_group_products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `groupID` INT NOT NULL,
  `presaleProductID` VARCHAR(50) NOT NULL,
  `position` INT DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_presale_group_product` (`groupID`, `presaleProductID`),
  INDEX `idx_presale_groupID` (`groupID`),
  CONSTRAINT `fk_presale_group_products_group` FOREIGN KEY (`groupID`) REFERENCES `presale_section_groups`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_presale_group_products_product` FOREIGN KEY (`presaleProductID`) REFERENCES `presale_products`(`presaleProductID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
