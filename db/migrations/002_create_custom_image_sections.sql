-- Migration: create custom_image_sections and section_images tables

CREATE TABLE IF NOT EXISTS `custom_image_sections` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sectionID` VARCHAR(128) DEFAULT NULL,
  `title` VARCHAR(255) DEFAULT NULL,
  `imageUrl` TEXT,
  `layoutID` VARCHAR(64) DEFAULT NULL,
  `isBannerised` TINYINT(1) DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `section_images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `section_id` INT NOT NULL,
  `routeTo` VARCHAR(255) DEFAULT NULL,
  `filters` TEXT,
  `imageUrl` TEXT,
  `position` INT DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_section_id` (`section_id`),
  CONSTRAINT `fk_section_images_section` FOREIGN KEY (`section_id`) REFERENCES `custom_image_sections`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

