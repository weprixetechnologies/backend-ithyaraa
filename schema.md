-- Adminer 4.8.1 MySQL 5.5.5-10.6.22-MariaDB-0ubuntu0.22.04.1 dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `address`;
CREATE TABLE `address` (
  `uid` varchar(50) DEFAULT NULL,
  `emailID` varchar(100) DEFAULT NULL,
  `phoneNumber` varchar(20) DEFAULT NULL,
  `line1` varchar(500) DEFAULT NULL,
  `line2` varchar(500) DEFAULT NULL,
  `pincode` varchar(20) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `landmark` varchar(500) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `addressID` varchar(50) NOT NULL,
  PRIMARY KEY (`addressID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `affiliateTransactions`;
CREATE TABLE `affiliateTransactions` (
  `txnID` varchar(100) NOT NULL,
  `uid` varchar(125) NOT NULL,
  `createdOn` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('pending','confirmed','completed','failed','rejected','returned','mPending','mConfirmed','mCompleted','mFailed','mRejected','mReturned') NOT NULL DEFAULT 'pending',
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `type` enum('incoming','outgoing','affiliate_return_deduction') NOT NULL,
  `orderID` bigint(20) DEFAULT NULL,
  `comment` text DEFAULT NULL,
  `lockedUntil` datetime DEFAULT NULL,
  `updatedOn` date DEFAULT NULL,
  `orderItemID` int(11) DEFAULT NULL,
  PRIMARY KEY (`txnID`),
  KEY `uid` (`uid`),
  KEY `type` (`type`),
  KEY `idx_orderID` (`orderID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `affiliate_bank_accounts`;
CREATE TABLE `affiliate_bank_accounts` (
  `bankAccountID` int(11) NOT NULL AUTO_INCREMENT,
  `uid` varchar(50) NOT NULL COMMENT 'Affiliate user ID',
  `accountHolderName` varchar(255) NOT NULL,
  `accountNumber` varchar(50) NOT NULL,
  `ifscCode` varchar(20) NOT NULL,
  `bankName` varchar(255) NOT NULL,
  `branchName` varchar(255) DEFAULT NULL,
  `accountType` enum('savings','current') DEFAULT 'savings',
  `panNumber` varchar(20) DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `isDefault` tinyint(1) DEFAULT 0 COMMENT 'Default account for payouts',
  `submittedBy` varchar(50) DEFAULT NULL COMMENT 'uid of who submitted',
  `approvedBy` varchar(50) DEFAULT NULL COMMENT 'admin uid who approved',
  `rejectedBy` varchar(50) DEFAULT NULL COMMENT 'admin uid who rejected',
  `rejectionReason` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `approvedAt` timestamp NULL DEFAULT NULL,
  `rejectedAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`bankAccountID`),
  UNIQUE KEY `unique_account` (`uid`,`accountNumber`,`ifscCode`),
  KEY `idx_uid` (`uid`),
  KEY `idx_status` (`status`),
  KEY `idx_uid_status` (`uid`,`status`),
  KEY `idx_uid_default` (`uid`,`isDefault`),
  KEY `idx_uid_approved` (`uid`,`status`,`isDefault`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `attributes`;
CREATE TABLE `attributes` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `value` longtext NOT NULL CHECK (json_valid(`value`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `brand_bank_details`;
CREATE TABLE `brand_bank_details` (
  `bankDetailID` int(11) NOT NULL AUTO_INCREMENT,
  `brandID` varchar(50) NOT NULL,
  `accountHolderName` varchar(255) NOT NULL,
  `accountNumber` varchar(50) NOT NULL,
  `ifscCode` varchar(20) NOT NULL,
  `bankName` varchar(255) NOT NULL,
  `branchName` varchar(255) DEFAULT NULL,
  `panNumber` varchar(20) DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `status` enum('pending','active','rejected') DEFAULT 'pending',
  `submittedBy` varchar(50) DEFAULT NULL COMMENT 'uid of who submitted (brand or admin)',
  `approvedBy` varchar(50) DEFAULT NULL COMMENT 'admin uid who approved',
  `rejectedBy` varchar(50) DEFAULT NULL COMMENT 'admin uid who rejected',
  `rejectionReason` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `approvedAt` timestamp NULL DEFAULT NULL,
  `rejectedAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`bankDetailID`),
  KEY `idx_brand` (`brandID`),
  KEY `idx_status` (`status`),
  KEY `idx_brand_status` (`brandID`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `brand_notifications`;
CREATE TABLE `brand_notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `notification_id` bigint(20) unsigned NOT NULL,
  `brand_id` varchar(255) NOT NULL COMMENT 'Brand UID from users.uid',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `read_at` datetime DEFAULT NULL,
  `email_status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  `email_sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_brand_notifications_notification` (`notification_id`),
  KEY `idx_brand_notifications_brand` (`brand_id`),
  KEY `idx_brand_notifications_is_read` (`is_read`),
  CONSTRAINT `fk_brand_notifications_notification` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `brand_settlement_payments`;
CREATE TABLE `brand_settlement_payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `settlementPeriodID` int(11) NOT NULL,
  `brandID` varchar(100) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `paymentMode` enum('bank_transfer','upi','neft','rtgs','cheque','adjustment','other') NOT NULL,
  `utrReference` varchar(100) DEFAULT NULL,
  `paymentDate` date NOT NULL,
  `bankDetailID` int(11) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `recordedBy` varchar(50) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_brandID` (`brandID`),
  KEY `idx_settlementPeriodID` (`settlementPeriodID`),
  CONSTRAINT `brand_settlement_payments_ibfk_1` FOREIGN KEY (`settlementPeriodID`) REFERENCES `brand_settlement_periods` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `brand_settlement_periods`;
CREATE TABLE `brand_settlement_periods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `brandID` varchar(100) NOT NULL,
  `settlementMonth` varchar(7) NOT NULL,
  `periodStart` date NOT NULL,
  `periodEnd` date NOT NULL,
  `commissionPct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `totalCredits` decimal(12,2) NOT NULL DEFAULT 0.00,
  `totalDebits` decimal(12,2) NOT NULL DEFAULT 0.00,
  `totalOnHold` decimal(12,2) NOT NULL DEFAULT 0.00,
  `netPayable` decimal(12,2) NOT NULL DEFAULT 0.00,
  `amountPaid` decimal(12,2) NOT NULL DEFAULT 0.00,
  `balanceDue` decimal(12,2) NOT NULL DEFAULT 0.00,
  `creditCount` int(11) NOT NULL DEFAULT 0,
  `debitCount` int(11) NOT NULL DEFAULT 0,
  `holdCount` int(11) NOT NULL DEFAULT 0,
  `status` enum('open','pending_payment','partially_paid','paid','on_hold') NOT NULL DEFAULT 'open',
  `notes` text DEFAULT NULL,
  `paidBy` varchar(50) DEFAULT NULL,
  `paidAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_brand_month` (`brandID`,`settlementMonth`),
  KEY `idx_brandID` (`brandID`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `cartDetail`;
CREATE TABLE `cartDetail` (
  `cartID` int(11) NOT NULL AUTO_INCREMENT,
  `uid` varchar(125) NOT NULL,
  `subtotal` decimal(10,2) DEFAULT 0.00,
  `total` decimal(10,2) DEFAULT 0.00,
  `totalDiscount` decimal(10,2) DEFAULT 0.00,
  `anyModifications` tinyint(1) DEFAULT 0,
  `modified` tinyint(1) DEFAULT 0,
  `lastProcessedAt` datetime DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `referBy` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`cartID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `cart_items`;
CREATE TABLE `cart_items` (
  `cartItemID` int(11) NOT NULL AUTO_INCREMENT,
  `cartID` int(11) NOT NULL,
  `uid` varchar(125) DEFAULT NULL,
  `productID` varchar(125) NOT NULL,
  `comboID` varchar(255) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `overridePrice` decimal(10,2) DEFAULT NULL,
  `salePrice` decimal(10,2) DEFAULT NULL,
  `regularPrice` decimal(10,2) NOT NULL,
  `unitPriceBefore` decimal(10,2) DEFAULT 0.00,
  `unitPriceAfter` decimal(10,2) DEFAULT 0.00,
  `lineTotalBefore` decimal(10,2) DEFAULT 0.00,
  `lineTotalAfter` decimal(10,2) DEFAULT 0.00,
  `offerID` varchar(225) DEFAULT NULL,
  `offerApplied` tinyint(1) DEFAULT 0,
  `offerStatus` enum('applied','expired','missing','none') DEFAULT 'none',
  `appliedOfferID` bigint(20) DEFAULT NULL,
  `name` varchar(500) DEFAULT NULL,
  `featuredImage` longtext DEFAULT NULL CHECK (json_valid(`featuredImage`)),
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `variationID` varchar(255) DEFAULT NULL,
  `variationName` varchar(255) DEFAULT NULL,
  `brandID` varchar(255) DEFAULT NULL,
  `custom_inputs` longtext DEFAULT NULL CHECK (json_valid(`custom_inputs`)),
  `isFlashSale` tinyint(1) DEFAULT NULL,
  `selected` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`cartItemID`),
  KEY `idx_cart_items_custom_inputs` (`custom_inputs`(255)),
  KEY `idx_cart_items_selected` (`selected`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `categoryID` int(11) NOT NULL AUTO_INCREMENT,
  `categoryName` varchar(255) NOT NULL,
  `featuredImage` varchar(500) DEFAULT NULL,
  `count` int(11) DEFAULT 0,
  `categoryBanner` varchar(500) DEFAULT NULL,
  `slug` varchar(255) NOT NULL,
  `createdOn` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`categoryID`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `coin_balance`;
CREATE TABLE `coin_balance` (
  `uid` varchar(64) NOT NULL,
  `balance` int(11) NOT NULL DEFAULT 0,
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `coin_lots`;
CREATE TABLE `coin_lots` (
  `lotID` int(11) NOT NULL AUTO_INCREMENT,
  `uid` varchar(64) NOT NULL,
  `orderID` int(11) DEFAULT NULL,
  `coinsTotal` int(11) NOT NULL,
  `coinsUsed` int(11) NOT NULL DEFAULT 0,
  `coinsExpired` int(11) NOT NULL DEFAULT 0,
  `earnedAt` datetime NOT NULL DEFAULT current_timestamp(),
  `expiresAt` datetime NOT NULL,
  `redeemableAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`lotID`),
  KEY `idx_coin_lots_uid` (`uid`),
  KEY `idx_coin_lots_expires` (`expiresAt`),
  KEY `idx_coin_lots_uid_expires` (`uid`,`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `coin_transactions`;
CREATE TABLE `coin_transactions` (
  `txnID` int(11) NOT NULL AUTO_INCREMENT,
  `uid` varchar(64) NOT NULL,
  `type` enum('earn','redeem','expire','reversal','pending') NOT NULL,
  `coins` int(11) NOT NULL,
  `refType` varchar(32) DEFAULT NULL,
  `refID` varchar(128) DEFAULT NULL,
  `meta` longtext DEFAULT NULL CHECK (json_valid(`meta`)),
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`txnID`),
  KEY `idx_coin_txn_uid` (`uid`),
  KEY `idx_coin_txn_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `combo_item`;
CREATE TABLE `combo_item` (
  `localID` int(11) NOT NULL AUTO_INCREMENT,
  `comboID` varchar(255) NOT NULL,
  `productID` varchar(255) NOT NULL,
  `productName` varchar(255) NOT NULL,
  `featuredImage` varchar(500) DEFAULT NULL,
  `categories` longtext DEFAULT NULL CHECK (json_valid(`categories`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`localID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `coupons`;
CREATE TABLE `coupons` (
  `couponID` varchar(255) NOT NULL,
  `couponCode` varchar(100) NOT NULL,
  `discountType` text NOT NULL,
  `discountValue` decimal(10,2) NOT NULL DEFAULT 0.00,
  `couponUsage` int(11) DEFAULT 0,
  `usageLimit` int(11) DEFAULT NULL,
  `maxUsagePerUser` int(11) DEFAULT NULL COMMENT 'Max times this coupon can be used per user; NULL = unlimited',
  `minOrderValue` decimal(10,2) DEFAULT NULL COMMENT 'Minimum order subtotal (eligible amount) required; NULL = no minimum',
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `assignedUser` text DEFAULT 'admin@ithyaraa.com',
  PRIMARY KEY (`couponID`),
  UNIQUE KEY `couponCode` (`couponCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `coupon_user_usage`;
CREATE TABLE `coupon_user_usage` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `couponID` varchar(255) NOT NULL,
  `uid` varchar(255) NOT NULL,
  `orderID` bigint(20) unsigned NOT NULL,
  `usedAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_coupon_order` (`couponID`,`orderID`),
  KEY `idx_coupon_uid` (`couponID`,`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `custom_image_sections`;
CREATE TABLE `custom_image_sections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sectionID` varchar(128) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `imageUrl` text DEFAULT NULL,
  `layoutID` varchar(64) DEFAULT NULL,
  `isBannerised` tinyint(1) DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `faqs`;
CREATE TABLE `faqs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `question` varchar(500) NOT NULL,
  `answer_html` mediumtext NOT NULL COMMENT 'Sanitized HTML content',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_question` (`question`(191)),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_active_sort` (`is_active`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `flash_sale_details`;
CREATE TABLE `flash_sale_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `saleID` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `startTime` datetime NOT NULL,
  `endTime` datetime NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `metadata` longtext DEFAULT NULL CHECK (json_valid(`metadata`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `saleID` (`saleID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `flash_sale_items`;
CREATE TABLE `flash_sale_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `saleItemID` varchar(128) NOT NULL,
  `saleID` varchar(64) NOT NULL,
  `productID` varchar(64) NOT NULL,
  `discountType` enum('percentage','fixed') NOT NULL,
  `discountValue` decimal(10,2) NOT NULL DEFAULT 0.00,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `saleItemID` (`saleItemID`),
  KEY `idx_fsi_sale` (`saleID`),
  KEY `idx_fsi_product` (`productID`),
  CONSTRAINT `fk_fsi_sale` FOREIGN KEY (`saleID`) REFERENCES `flash_sale_details` (`saleID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `giftcards`;
CREATE TABLE `giftcards` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `card_number_hmac` char(64) NOT NULL,
  `card_last4` char(4) NOT NULL,
  `pin_hash` varchar(255) NOT NULL,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('active','redeemed','disabled','expired') NOT NULL DEFAULT 'active',
  `expires_at` datetime DEFAULT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `metadata` longtext DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_giftcards_card_number_hmac` (`card_number_hmac`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `group_products`;
CREATE TABLE `group_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `groupID` int(11) NOT NULL,
  `productID` varchar(64) NOT NULL,
  `position` int(11) DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_group_product` (`groupID`,`productID`),
  KEY `idx_groupID` (`groupID`),
  CONSTRAINT `fk_group_products_group` FOREIGN KEY (`groupID`) REFERENCES `product_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `homepage_sections`;
CREATE TABLE `homepage_sections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) DEFAULT NULL,
  `image` text NOT NULL COMMENT 'Image URL',
  `link` text DEFAULT NULL COMMENT 'Fallback link',
  `routeTo` varchar(255) DEFAULT NULL COMMENT 'Frontend route name (e.g., shop, category)',
  `filters` longtext DEFAULT NULL COMMENT 'Shop filters object (type, categoryID, offerID, minPrice, maxPrice, sortBy, etc.)' CHECK (json_valid(`filters`)),
  `fallbackLink` text DEFAULT NULL COMMENT 'Constructed link: FRONTEND_URL/routeTo?filters',
  `position` int(11) NOT NULL DEFAULT 0 COMMENT 'Order on homepage',
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_position` (`position`),
  KEY `idx_isActive` (`isActive`),
  KEY `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `home_categories`;
CREATE TABLE `home_categories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `categoryID` int(10) unsigned NOT NULL,
  `imageUrl` varchar(512) NOT NULL,
  `sortOrder` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `home_slider_banners`;
CREATE TABLE `home_slider_banners` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` enum('mobile','desktop') NOT NULL COMMENT 'mobile=1:1, desktop=1470:489',
  `image_url` varchar(1024) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_type_position` (`type`,`position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `make_combo_items`;
CREATE TABLE `make_combo_items` (
  `localID` int(11) NOT NULL AUTO_INCREMENT,
  `comboID` varchar(255) NOT NULL,
  `productID` varchar(255) NOT NULL,
  `productName` varchar(255) NOT NULL,
  `featuredImage` varchar(500) DEFAULT NULL,
  `categories` longtext DEFAULT NULL CHECK (json_valid(`categories`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `variationID` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`localID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `newsletters`;
CREATE TABLE `newsletters` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content_html` mediumtext NOT NULL,
  `content_text` mediumtext DEFAULT NULL,
  `status` enum('draft','scheduled','sent') NOT NULL DEFAULT 'draft',
  `scheduled_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_newsletters_status` (`status`),
  KEY `idx_newsletters_sent_at` (`sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `newsletter_deliveries`;
CREATE TABLE `newsletter_deliveries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `newsletter_id` bigint(20) unsigned NOT NULL,
  `subscriber_id` bigint(20) unsigned NOT NULL,
  `status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  `error_message` text DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_deliveries_newsletter` (`newsletter_id`),
  KEY `idx_deliveries_subscriber` (`subscriber_id`),
  KEY `idx_deliveries_status` (`status`),
  CONSTRAINT `fk_deliveries_newsletter` FOREIGN KEY (`newsletter_id`) REFERENCES `newsletters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_deliveries_subscriber` FOREIGN KEY (`subscriber_id`) REFERENCES `newsletter_subscribers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `newsletter_subscribers`;
CREATE TABLE `newsletter_subscribers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(320) NOT NULL,
  `status` enum('active','unsubscribed','bounced') NOT NULL DEFAULT 'active',
  `subscribed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `unsubscribed_at` datetime DEFAULT NULL,
  `last_email_sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_newsletter_subscribers_email` (`email`),
  KEY `idx_newsletter_subscribers_status` (`status`),
  KEY `idx_newsletter_subscribers_email_status` (`email`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content_html` mediumtext NOT NULL COMMENT 'Sanitized rich HTML content (pasted from Word)',
  `image_url` text DEFAULT NULL COMMENT 'Optional single image URL (existing upload system)',
  `type` enum('offer','deal','participation','general') NOT NULL DEFAULT 'general',
  `created_by` varchar(255) DEFAULT NULL COMMENT 'Admin UID / identifier',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_type` (`type`),
  KEY `idx_notifications_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `offers`;
CREATE TABLE `offers` (
  `offerID` varchar(255) NOT NULL,
  `offerName` varchar(255) NOT NULL,
  `offerType` varchar(100) NOT NULL,
  `buyAt` int(11) DEFAULT NULL,
  `buyCount` int(11) NOT NULL DEFAULT 0,
  `getCount` int(11) NOT NULL DEFAULT 0,
  `offerMobileBanner` varchar(500) DEFAULT NULL,
  `offerBanner` varchar(500) DEFAULT NULL,
  `products` longtext DEFAULT NULL CHECK (json_valid(`products`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`offerID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `orderDetail`;
CREATE TABLE `orderDetail` (
  `orderID` int(11) NOT NULL AUTO_INCREMENT,
  `uid` varchar(125) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `totalDiscount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `modified` tinyint(1) DEFAULT 0,
  `createdAt` datetime DEFAULT current_timestamp(),
  `txnID` varchar(500) NOT NULL,
  `addressID` varchar(125) DEFAULT NULL,
  `shippingName` varchar(255) DEFAULT NULL,
  `shippingPhone` varchar(20) DEFAULT NULL,
  `shippingEmail` varchar(255) DEFAULT NULL,
  `shippingLine1` varchar(500) DEFAULT NULL,
  `shippingLine2` varchar(500) DEFAULT NULL,
  `shippingCity` varchar(100) DEFAULT NULL,
  `shippingState` varchar(100) DEFAULT NULL,
  `shippingPincode` varchar(10) DEFAULT NULL,
  `shippingLandmark` varchar(255) DEFAULT NULL,
  `paymentMode` varchar(50) NOT NULL DEFAULT 'cod',
  `trackingID` varchar(100) DEFAULT NULL,
  `deliveryCompany` varchar(100) DEFAULT NULL,
  `couponCode` varchar(50) DEFAULT NULL,
  `couponDiscount` decimal(10,2) DEFAULT 0.00,
  `shippingFee` decimal(10,2) DEFAULT 0.00,
  `merchantID` varchar(100) DEFAULT NULL,
  `orderStatus` varchar(50) DEFAULT 'pending',
  `referBy` varchar(255) DEFAULT NULL,
  `paymentStatus` varchar(100) DEFAULT 'pending',
  `coinsEarned` int(11) NOT NULL DEFAULT 0,
  `isWalletUsed` tinyint(1) NOT NULL DEFAULT 0,
  `paidWallet` decimal(12,2) NOT NULL DEFAULT 0.00,
  `handlingFee` tinyint(1) DEFAULT 0,
  `handFeeRate` decimal(10,2) DEFAULT 0.00,
  `status` text DEFAULT NULL,
  `deliveredAt` datetime DEFAULT NULL,
  `isReplacement` tinyint(1) NOT NULL DEFAULT 0,
  `isBuyNow` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`orderID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `order_combo_items`;
CREATE TABLE `order_combo_items` (
  `comboItemID` int(11) NOT NULL AUTO_INCREMENT,
  `comboID` varchar(125) NOT NULL,
  `productID` varchar(50) NOT NULL,
  `variationID` varchar(50) DEFAULT NULL,
  `productName` varchar(255) NOT NULL,
  `featuredImage` varchar(500) DEFAULT NULL,
  `variationName` varchar(255) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `quantity` int(11) DEFAULT 1,
  PRIMARY KEY (`comboItemID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `orderItemID` int(11) NOT NULL AUTO_INCREMENT,
  `orderID` int(11) NOT NULL,
  `uid` varchar(125) DEFAULT NULL,
  `productID` varchar(125) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `variationID` varchar(125) DEFAULT NULL,
  `variationName` varchar(255) DEFAULT NULL,
  `overridePrice` decimal(10,2) DEFAULT NULL,
  `salePrice` decimal(10,2) DEFAULT NULL,
  `regularPrice` decimal(10,2) NOT NULL DEFAULT 0.00,
  `unitPriceBefore` decimal(10,2) DEFAULT 0.00,
  `unitPriceAfter` decimal(10,2) DEFAULT 0.00,
  `lineTotalBefore` decimal(10,2) DEFAULT 0.00,
  `lineTotalAfter` decimal(10,2) DEFAULT 0.00,
  `offerID` varchar(225) DEFAULT NULL,
  `offerApplied` tinyint(1) DEFAULT 0,
  `offerStatus` enum('applied','expired','missing','none') DEFAULT 'none',
  `appliedOfferID` bigint(20) DEFAULT NULL,
  `name` varchar(500) DEFAULT NULL,
  `featuredImage` longtext DEFAULT NULL CHECK (json_valid(`featuredImage`)),
  `comboID` varchar(125) DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `referBy` varchar(500) NOT NULL,
  `custom_inputs` text DEFAULT NULL,
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `brandID` varchar(100) DEFAULT 'inhouse',
  `brandShippingFee` decimal(10,2) DEFAULT 0.00,
  `trackingCode` varchar(200) DEFAULT NULL,
  `deliveryCompany` varchar(100) DEFAULT NULL,
  `itemStatus` varchar(100) DEFAULT 'pending',
  `returnStatus` enum('none','return_approval','refund_approval','replacement_approval','return_requested','return_initiated','return_picked','replacement_processing','replacement_shipped','replacement_complete','returned','refund_pending','refund_completed','returnRejected') NOT NULL DEFAULT 'none',
  `returnRequestedAt` datetime DEFAULT NULL,
  `replacementOrderItemID` varchar(50) DEFAULT NULL,
  `refundQueryID` varchar(50) DEFAULT NULL,
  `earnedCoins` int(11) NOT NULL DEFAULT 0,
  `coinLockUntil` datetime DEFAULT NULL,
  `coinsReversed` tinyint(1) NOT NULL DEFAULT 0,
  `replacementOrderID` int(11) DEFAULT NULL,
  `returnTrackingCode` varchar(255) DEFAULT NULL,
  `returnDeliveryCompany` varchar(255) DEFAULT NULL,
  `returnTrackingUrl` varchar(512) DEFAULT NULL,
  `settlementID` int(11) DEFAULT NULL,
  `settlementStatus` enum('unsettled','included','deducted','carried_forward') DEFAULT 'unsettled',
  `wasCarriedForward` tinyint(1) DEFAULT 0,
  `returnType` enum('refund','replacement') DEFAULT NULL,
  `returnReason` varchar(500) DEFAULT NULL,
  `returnComments` text DEFAULT NULL,
  `returnPhotos` longtext DEFAULT NULL,
  PRIMARY KEY (`orderItemID`),
  KEY `idx_order_items_replacement_order` (`replacementOrderID`),
  KEY `idx_settlement` (`settlementID`),
  KEY `idx_settlementStatus` (`settlementStatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `otp_sent`;
CREATE TABLE `otp_sent` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `otpHash` varchar(255) NOT NULL,
  `identifier` varchar(100) DEFAULT NULL,
  `type` enum('email','phone') DEFAULT 'phone',
  `sentOn` datetime NOT NULL DEFAULT current_timestamp(),
  `expiry` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_phoneNumber` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `presale_booking_details`;
CREATE TABLE `presale_booking_details` (
  `preBookingID` bigint(20) NOT NULL AUTO_INCREMENT,
  `uid` varchar(20) NOT NULL,
  `addressLine1` varchar(255) NOT NULL,
  `addressLine2` varchar(255) DEFAULT NULL,
  `pincode` varchar(10) NOT NULL,
  `landmark` varchar(255) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `phoneNumber` varchar(20) DEFAULT NULL,
  `subtotal` decimal(10,2) DEFAULT 0.00,
  `total` decimal(10,2) DEFAULT 0.00,
  `discount` decimal(10,2) DEFAULT 0.00,
  `deliveryCompany` varchar(100) DEFAULT NULL,
  `trackingCode` varchar(100) DEFAULT NULL,
  `paymentStatus` enum('pending','successful','paid','failed','refunded') DEFAULT 'pending',
  `orderStatus` enum('pending','accepted','packed','shipped','delivered','cancelled','returned') DEFAULT 'pending',
  `status` enum('pending','confirmed','shipped','delivered','cancelled') DEFAULT 'pending',
  `txnID` varchar(150) DEFAULT NULL,
  `merchantID` varchar(150) DEFAULT NULL,
  `isWalletUsed` tinyint(1) DEFAULT 0,
  `paidWallet` decimal(10,2) DEFAULT 0.00,
  `coinsEarned` int(11) DEFAULT 0,
  `paymentType` text DEFAULT 'online',
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`preBookingID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `presale_booking_items`;
CREATE TABLE `presale_booking_items` (
  `preBookingItemID` bigint(20) NOT NULL AUTO_INCREMENT,
  `preBookingID` bigint(20) NOT NULL,
  `productID` varchar(50) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `variationID` varchar(30) DEFAULT NULL,
  `variationSlug` varchar(255) DEFAULT NULL,
  `variationName` varchar(255) DEFAULT NULL,
  `salePrice` decimal(10,2) DEFAULT 0.00,
  `regularPrice` decimal(10,2) DEFAULT 0.00,
  `unitPrice` decimal(10,2) DEFAULT 0.00,
  `unitSalePrice` decimal(10,2) DEFAULT 0.00,
  `featuredImage` varchar(500) DEFAULT NULL,
  `referBy` varchar(20) DEFAULT NULL,
  `brandID` varchar(40) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`preBookingItemID`),
  KEY `idx_preBookingID` (`preBookingID`),
  KEY `idx_productID` (`productID`),
  CONSTRAINT `presale_booking_items_ibfk_1` FOREIGN KEY (`preBookingID`) REFERENCES `presale_booking_details` (`preBookingID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `presale_details`;
CREATE TABLE `presale_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `presaleGroupID` varchar(50) NOT NULL,
  `groupName` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `bannerImage` longtext DEFAULT NULL CHECK (json_valid(`bannerImage`)),
  `featuredImage` longtext DEFAULT NULL CHECK (json_valid(`featuredImage`)),
  `startDate` datetime NOT NULL,
  `endDate` datetime NOT NULL,
  `expectedDeliveryDate` date DEFAULT NULL,
  `status` enum('upcoming','active','completed','cancelled') DEFAULT 'upcoming',
  `groupDiscountType` enum('percentage','flat') DEFAULT NULL,
  `groupDiscountValue` decimal(10,2) DEFAULT NULL,
  `earlyBirdDiscount` decimal(10,2) DEFAULT NULL,
  `earlyBirdEndDate` datetime DEFAULT NULL,
  `displayOrder` int(11) DEFAULT 0,
  `isFeatured` tinyint(1) DEFAULT 0,
  `showOnHomepage` tinyint(1) DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `presaleGroupID` (`presaleGroupID`),
  KEY `idx_presale_group_id` (`presaleGroupID`),
  KEY `idx_status` (`status`),
  KEY `idx_dates` (`startDate`,`endDate`),
  KEY `idx_display` (`displayOrder`,`isFeatured`,`showOnHomepage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `presale_group_products`;
CREATE TABLE `presale_group_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `presaleGroupID` varchar(50) NOT NULL,
  `presaleProductID` varchar(50) NOT NULL,
  `displayOrder` int(11) DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_group_product` (`presaleGroupID`,`presaleProductID`),
  KEY `idx_group` (`presaleGroupID`),
  KEY `idx_product` (`presaleProductID`),
  KEY `idx_display_order` (`presaleGroupID`,`displayOrder`),
  CONSTRAINT `presale_group_products_ibfk_1` FOREIGN KEY (`presaleGroupID`) REFERENCES `presale_details` (`presaleGroupID`) ON DELETE CASCADE,
  CONSTRAINT `presale_group_products_ibfk_2` FOREIGN KEY (`presaleProductID`) REFERENCES `presale_products` (`presaleProductID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `presale_products`;
CREATE TABLE `presale_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `presaleProductID` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `regularPrice` decimal(10,2) NOT NULL,
  `salePrice` decimal(10,2) DEFAULT NULL,
  `discountType` enum('percentage','flat') DEFAULT NULL,
  `discountValue` decimal(10,2) DEFAULT NULL,
  `type` enum('variable','simple') DEFAULT 'variable',
  `status` enum('active','inactive','completed') DEFAULT 'active',
  `offerID` varchar(50) DEFAULT NULL,
  `overridePrice` decimal(10,2) DEFAULT NULL,
  `tab1` text DEFAULT NULL,
  `tab2` text DEFAULT NULL,
  `featuredImage` longtext DEFAULT NULL CHECK (json_valid(`featuredImage`)),
  `productAttributes` longtext DEFAULT NULL CHECK (json_valid(`productAttributes`)),
  `categories` longtext DEFAULT NULL CHECK (json_valid(`categories`)),
  `brand` varchar(255) DEFAULT NULL,
  `galleryImage` longtext DEFAULT NULL CHECK (json_valid(`galleryImage`)),
  `brandID` varchar(50) DEFAULT NULL,
  `custom_inputs` longtext DEFAULT NULL CHECK (json_valid(`custom_inputs`)),
  `allowCustomerImageUpload` tinyint(1) DEFAULT 0,
  `expectedDeliveryDate` date DEFAULT NULL,
  `minOrderQuantity` int(11) DEFAULT 1,
  `maxOrderQuantity` int(11) DEFAULT NULL,
  `totalAvailableQuantity` int(11) DEFAULT NULL,
  `reservedQuantity` int(11) DEFAULT 0,
  `preSaleStartDate` datetime DEFAULT NULL,
  `preSaleEndDate` datetime DEFAULT NULL,
  `earlyBirdDiscount` decimal(10,2) DEFAULT NULL,
  `earlyBirdEndDate` datetime DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `presaleProductID` (`presaleProductID`),
  KEY `idx_presale_product_id` (`presaleProductID`),
  KEY `idx_status` (`status`),
  KEY `idx_brand` (`brandID`),
  KEY `idx_preSale_dates` (`preSaleStartDate`,`preSaleEndDate`),
  KEY `idx_expected_delivery` (`expectedDeliveryDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `productID` varchar(255) NOT NULL,
  `sectionid` varchar(100) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `regularPrice` decimal(10,2) NOT NULL DEFAULT 0.00,
  `salePrice` decimal(10,2) DEFAULT NULL,
  `discountType` text DEFAULT NULL,
  `discountValue` decimal(10,2) DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `status` text DEFAULT 'active',
  `offerID` text DEFAULT NULL,
  `overridePrice` decimal(10,2) DEFAULT NULL,
  `tab1` longtext DEFAULT NULL,
  `tab2` longtext DEFAULT NULL,
  `featuredImage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`featuredImage`)),
  `productAttributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`productAttributes`)),
  `categories` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`categories`)),
  `brand` varchar(255) DEFAULT NULL,
  `galleryImage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`galleryImage`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `isWished` tinyint(1) DEFAULT 0,
  `brandID` varchar(100) DEFAULT NULL,
  `custom_inputs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`custom_inputs`)),
  `dressTypes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`dressTypes`)),
  `allowCustomerImageUpload` tinyint(1) DEFAULT 0,
  `slug` varchar(255) DEFAULT NULL,
  `sizeChartUrl` varchar(1024) DEFAULT NULL,
  PRIMARY KEY (`productID`),
  UNIQUE KEY `idx_products_slug` (`slug`),
  KEY `idx_products_custom_inputs` (`custom_inputs`(255)),
  KEY `idx_products_slug_lookup` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `product_cross_sells`;
CREATE TABLE `product_cross_sells` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `productID` varchar(50) NOT NULL,
  `crossSellProductID` varchar(50) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_cross_sell` (`productID`,`crossSellProductID`),
  KEY `idx_product` (`productID`),
  KEY `idx_cross_sell_product` (`crossSellProductID`),
  KEY `idx_product_cross_sell` (`productID`,`crossSellProductID`),
  CONSTRAINT `product_cross_sells_ibfk_1` FOREIGN KEY (`productID`) REFERENCES `products` (`productID`) ON DELETE CASCADE,
  CONSTRAINT `product_cross_sells_ibfk_2` FOREIGN KEY (`crossSellProductID`) REFERENCES `products` (`productID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `product_groups`;
CREATE TABLE `product_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sectionID` int(11) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `orderIndex` int(11) DEFAULT 0,
  `imageUrl` text DEFAULT NULL,
  `isBannerised` tinyint(1) DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `reels`;
CREATE TABLE `reels` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `video_url` varchar(255) NOT NULL,
  `thumbnail_url` varchar(255) DEFAULT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `refund_queries`;
CREATE TABLE `refund_queries` (
  `refundQueryID` varchar(50) NOT NULL,
  `orderID` int(11) NOT NULL,
  `orderItemID` int(11) NOT NULL,
  `productID` varchar(125) NOT NULL,
  `userID` varchar(125) NOT NULL,
  `brandID` varchar(100) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `returnType` varchar(50) DEFAULT 'refund',
  `comments` text DEFAULT NULL,
  `photos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`photos`)),
  PRIMARY KEY (`refundQueryID`),
  KEY `idx_refund_queries_order` (`orderID`),
  KEY `idx_refund_queries_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `refund_queries_resolved`;
CREATE TABLE `refund_queries_resolved` (
  `refundQueryID` varchar(50) NOT NULL,
  `orderID` int(11) NOT NULL,
  `orderItemID` int(11) NOT NULL,
  `productID` varchar(125) NOT NULL,
  `userID` varchar(125) NOT NULL,
  `brandID` varchar(100) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `returnType` varchar(50) DEFAULT 'refund',
  `comments` text DEFAULT NULL,
  `photos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`photos`)),
  `resolvedAt` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`refundQueryID`),
  KEY `idx_refund_queries_order` (`orderID`),
  KEY `idx_refund_queries_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `reviews`;
CREATE TABLE `reviews` (
  `reviewID` int(11) NOT NULL AUTO_INCREMENT,
  `productID` varchar(50) NOT NULL,
  `uid` varchar(50) NOT NULL,
  `orderID` int(11) DEFAULT NULL,
  `rating` int(11) NOT NULL CHECK (`rating` >= 1 and `rating` <= 5),
  `comment` text DEFAULT NULL,
  `images` longtext DEFAULT NULL CHECK (json_valid(`images`)),
  `helpful_count` int(11) DEFAULT 0,
  `verified_purchase` tinyint(1) DEFAULT 0,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`reviewID`),
  KEY `idx_product` (`productID`),
  KEY `idx_uid` (`uid`),
  KEY `idx_order` (`orderID`),
  KEY `idx_status` (`status`),
  KEY `idx_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `review_helpful`;
CREATE TABLE `review_helpful` (
  `reviewHelpfulID` int(11) NOT NULL AUTO_INCREMENT,
  `reviewID` int(11) NOT NULL,
  `uid` varchar(50) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`reviewHelpfulID`),
  UNIQUE KEY `unique_review_user` (`reviewID`,`uid`),
  KEY `idx_review` (`reviewID`),
  CONSTRAINT `review_helpful_ibfk_1` FOREIGN KEY (`reviewID`) REFERENCES `reviews` (`reviewID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `review_images`;
CREATE TABLE `review_images` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `reviewID` bigint(20) unsigned NOT NULL,
  `imageUrl` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `review_replies`;
CREATE TABLE `review_replies` (
  `replyID` int(11) NOT NULL AUTO_INCREMENT,
  `reviewID` int(11) NOT NULL,
  `uid` varchar(50) NOT NULL,
  `reply` text NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`replyID`),
  KEY `idx_review` (`reviewID`),
  KEY `idx_uid` (`uid`),
  CONSTRAINT `review_replies_ibfk_1` FOREIGN KEY (`reviewID`) REFERENCES `reviews` (`reviewID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `section_images`;
CREATE TABLE `section_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `section_id` int(11) NOT NULL,
  `routeTo` varchar(255) DEFAULT NULL,
  `filters` text DEFAULT NULL,
  `imageUrl` text DEFAULT NULL,
  `position` int(11) DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_section_id` (`section_id`),
  CONSTRAINT `fk_section_images_section` FOREIGN KEY (`section_id`) REFERENCES `custom_image_sections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `section_items`;
CREATE TABLE `section_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `type` varchar(64) NOT NULL,
  `itemId` bigint(20) unsigned NOT NULL,
  `orderIndex` int(11) NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_type_order` (`type`,`orderIndex`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `sessions`;
CREATE TABLE `sessions` (
  `sessionID` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phonenumber` varchar(255) DEFAULT NULL,
  `deviceInfo` text DEFAULT NULL,
  `refreshToken` text NOT NULL,
  `expiry` datetime DEFAULT NULL,
  PRIMARY KEY (`sessionID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `setting_key` varchar(255) NOT NULL,
  `setting_value` text NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `settlement_failed_events`;
CREATE TABLE `settlement_failed_events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `orderItemId` varchar(36) NOT NULL,
  `event` varchar(64) NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`payload`)),
  `error` text DEFAULT NULL,
  `retryCount` int(11) DEFAULT 0,
  `resolvedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `settlement_order_details`;
CREATE TABLE `settlement_order_details` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `brandID` varchar(100) NOT NULL,
  `orderItemID` int(11) NOT NULL,
  `orderID` int(11) NOT NULL,
  `productID` varchar(125) NOT NULL,
  `productName` varchar(500) DEFAULT NULL,
  `variationName` varchar(255) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `lineTotalAfter` decimal(10,2) NOT NULL,
  `commissionPct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `commissionAmount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `brandEarning` decimal(10,2) NOT NULL DEFAULT 0.00,
  `settlementMonth` varchar(7) NOT NULL,
  `event` varchar(64) NOT NULL,
  `effect` varchar(64) NOT NULL,
  `effectAmount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `isReplacement` tinyint(1) NOT NULL DEFAULT 0,
  `wasCarriedForward` tinyint(1) NOT NULL DEFAULT 0,
  `refundQueryID` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `createdBy` varchar(100) DEFAULT NULL,
  `relatedOrderItemId` varchar(36) DEFAULT NULL COMMENT 'Links replacement_item back to its original orderItemId',
  `resolvedAt` timestamp NULL DEFAULT NULL COMMENT 'When the entry was manually resolved or cleared',
  PRIMARY KEY (`id`),
  KEY `idx_brand` (`brandID`),
  KEY `idx_orderItemID` (`orderItemID`),
  KEY `idx_orderID` (`orderID`),
  KEY `idx_month` (`settlementMonth`),
  KEY `idx_brand_month` (`brandID`,`settlementMonth`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `size_charts`;
CREATE TABLE `size_charts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `chartName` varchar(255) NOT NULL,
  `imgUrl` varchar(1024) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `brandID` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `support_tickets`;
CREATE TABLE `support_tickets` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ticket_no` varchar(20) NOT NULL,
  `raised_by_type` enum('user','brand') NOT NULL,
  `raised_by_id` varchar(50) NOT NULL,
  `topic_path` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`topic_path`)),
  `leaf_topic_id` bigint(20) unsigned NOT NULL,
  `comment` text NOT NULL,
  `status` enum('open','in_progress','closed') NOT NULL DEFAULT 'open',
  `priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `assigned_to` bigint(20) unsigned DEFAULT NULL,
  `first_response_at` timestamp NULL DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `has_unread_by_raiser` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_no` (`ticket_no`),
  KEY `idx_raised_by` (`raised_by_type`,`raised_by_id`),
  KEY `idx_status` (`status`),
  KEY `idx_leaf_topic` (`leaf_topic_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `support_ticket_replies`;
CREATE TABLE `support_ticket_replies` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ticket_id` bigint(20) unsigned NOT NULL,
  `sender_type` enum('user','brand','admin') NOT NULL,
  `sender_id` varchar(50) NOT NULL,
  `message` text NOT NULL,
  `is_internal` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ticket` (`ticket_id`),
  KEY `idx_sender` (`sender_type`,`sender_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `support_topics`;
CREATE TABLE `support_topics` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` bigint(20) unsigned DEFAULT NULL,
  `panel` enum('user','brand','both') NOT NULL DEFAULT 'both',
  `label` varchar(120) NOT NULL,
  `slug` varchar(120) NOT NULL,
  `description` text DEFAULT NULL,
  `input_type` enum('branch','leaf') NOT NULL DEFAULT 'branch',
  `prefilled_text` text DEFAULT NULL,
  `sort_order` smallint(6) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_parent` (`parent_id`),
  KEY `idx_panel` (`panel`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `username` varchar(50) NOT NULL,
  `emailID` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `profilePhoto` varchar(512) DEFAULT NULL,
  `phonenumber` varchar(100) DEFAULT NULL,
  `deviceInfo` text DEFAULT NULL,
  `lastLogin` datetime DEFAULT NULL,
  `joinedOn` varchar(255) DEFAULT NULL,
  `balance` decimal(15,2) DEFAULT 0.00,
  `shippingCharge` decimal(10,2) DEFAULT 0.00,
  `gstin` varchar(15) DEFAULT NULL,
  `pendingPayment` decimal(10,2) NOT NULL DEFAULT 0.00,
  `verifiedEmail` tinyint(1) DEFAULT NULL,
  `verifiedPhone` tinyint(1) DEFAULT NULL,
  `uid` varchar(255) DEFAULT NULL,
  `referCode` varchar(50) DEFAULT NULL,
  `createdOn` datetime DEFAULT current_timestamp(),
  `role` varchar(255) DEFAULT NULL,
  `affiliate` varchar(255) DEFAULT NULL,
  `newsletter_joined` tinyint(1) NOT NULL DEFAULT 0,
  `commissionPercentage` decimal(5,2) DEFAULT NULL,
  `unread_ticket_replies` smallint(5) unsigned DEFAULT 0,
  PRIMARY KEY (`username`),
  UNIQUE KEY `emailID` (`emailID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `variations`;
CREATE TABLE `variations` (
  `variationID` text DEFAULT NULL,
  `variationName` varchar(255) NOT NULL,
  `variationSlug` varchar(255) NOT NULL,
  `variationPrice` decimal(10,2) NOT NULL DEFAULT 0.00,
  `variationSalePrice` decimal(10,2) DEFAULT NULL,
  `variationStock` int(11) DEFAULT 0,
  `variationValues` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`variationValues`)),
  `productID` varchar(255) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `wishlist`;
CREATE TABLE `wishlist` (
  `wishlistID` varchar(50) NOT NULL,
  `uid` varchar(50) NOT NULL,
  `productID` varchar(50) NOT NULL,
  `featuredImage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`featuredImage`)),
  `regularPrice` decimal(10,2) NOT NULL,
  `salePrice` decimal(10,2) DEFAULT NULL,
  `categories` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`categories`)),
  `brand` varchar(100) DEFAULT NULL,
  `slug` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`wishlistID`),
  UNIQUE KEY `uid` (`uid`,`productID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `wishlistDetail`;
CREATE TABLE `wishlistDetail` (
  `wishlistID` varchar(100) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `uid` varchar(100) NOT NULL,
  PRIMARY KEY (`wishlistID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `wishlist_items`;
CREATE TABLE `wishlist_items` (
  `wishlistItemID` varchar(100) NOT NULL,
  `wishlistID` varchar(100) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `uid` varchar(100) NOT NULL,
  `productID` varchar(100) NOT NULL,
  `productType` varchar(100) NOT NULL,
  PRIMARY KEY (`wishlistItemID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


