-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Dec 23, 2025 at 05:26 PM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ithyaraa`
--

-- --------------------------------------------------------

--
-- Table structure for table `address`
--

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
  `addressID` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `affiliateTransactions`
--

CREATE TABLE `affiliateTransactions` (
  `txnID` varchar(100) NOT NULL,
  `uid` varchar(125) NOT NULL,
  `createdOn` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('pending','completed','failed','rejected') NOT NULL DEFAULT 'pending',
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `type` enum('incoming','outgoing') NOT NULL,
  `updatedOn` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `affiliate_bank_accounts`
--

CREATE TABLE `affiliate_bank_accounts` (
  `bankAccountID` int(11) NOT NULL,
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
  `rejectedAt` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `attributes`
--

CREATE TABLE `attributes` (
  `ID` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`value`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `brand_bank_details`
--

CREATE TABLE `brand_bank_details` (
  `bankDetailID` int(11) NOT NULL,
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
  `rejectedAt` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cartDetail`
--

CREATE TABLE `cartDetail` (
  `cartID` int(11) NOT NULL,
  `uid` varchar(125) NOT NULL,
  `subtotal` decimal(10,2) DEFAULT 0.00,
  `total` decimal(10,2) DEFAULT 0.00,
  `totalDiscount` decimal(10,2) DEFAULT 0.00,
  `anyModifications` tinyint(1) DEFAULT 0,
  `modified` tinyint(1) DEFAULT 0,
  `lastProcessedAt` datetime DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `referBy` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cart_items`
--

CREATE TABLE `cart_items` (
  `cartItemID` int(11) NOT NULL,
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
  `featuredImage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`featuredImage`)),
  `createdAt` datetime DEFAULT current_timestamp(),
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `variationID` varchar(255) DEFAULT NULL,
  `variationName` varchar(255) DEFAULT NULL,
  `brandID` varchar(255) DEFAULT NULL,
  `custom_inputs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`custom_inputs`)),
  `isFlashSale` tinyint(1) DEFAULT NULL,
  `selected` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `categoryID` int(11) NOT NULL,
  `categoryName` varchar(255) NOT NULL,
  `featuredImage` varchar(500) DEFAULT NULL,
  `count` int(11) DEFAULT 0,
  `categoryBanner` varchar(500) DEFAULT NULL,
  `slug` varchar(255) NOT NULL,
  `createdOn` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `coin_balance`
--

CREATE TABLE `coin_balance` (
  `uid` varchar(64) NOT NULL,
  `balance` int(11) NOT NULL DEFAULT 0,
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `coin_lots`
--

CREATE TABLE `coin_lots` (
  `lotID` int(11) NOT NULL,
  `uid` varchar(64) NOT NULL,
  `orderID` int(11) DEFAULT NULL,
  `coinsTotal` int(11) NOT NULL,
  `coinsUsed` int(11) NOT NULL DEFAULT 0,
  `coinsExpired` int(11) NOT NULL DEFAULT 0,
  `earnedAt` datetime NOT NULL DEFAULT current_timestamp(),
  `expiresAt` datetime NOT NULL,
  `redeemableAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `coin_transactions`
--

CREATE TABLE `coin_transactions` (
  `txnID` int(11) NOT NULL,
  `uid` varchar(64) NOT NULL,
  `type` enum('earn','redeem','expire','reversal','pending') NOT NULL,
  `coins` int(11) NOT NULL,
  `refType` varchar(32) DEFAULT NULL,
  `refID` varchar(128) DEFAULT NULL,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `createdAt` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `combo_item`
--

CREATE TABLE `combo_item` (
  `localID` int(11) NOT NULL,
  `comboID` varchar(255) NOT NULL,
  `productID` varchar(255) NOT NULL,
  `productName` varchar(255) NOT NULL,
  `featuredImage` varchar(500) DEFAULT NULL,
  `categories` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`categories`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `coupons`
--

CREATE TABLE `coupons` (
  `couponID` varchar(255) NOT NULL,
  `couponCode` varchar(100) NOT NULL,
  `discountType` text NOT NULL,
  `discountValue` decimal(10,2) NOT NULL DEFAULT 0.00,
  `couponUsage` int(11) DEFAULT 0,
  `usageLimit` int(11) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `assignedUser` text DEFAULT 'admin@ithyaraa.com'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `flash_sale_details`
--

CREATE TABLE `flash_sale_details` (
  `id` int(11) NOT NULL,
  `saleID` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `startTime` datetime NOT NULL,
  `endTime` datetime NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `flash_sale_items`
--

CREATE TABLE `flash_sale_items` (
  `id` int(11) NOT NULL,
  `saleItemID` varchar(128) NOT NULL,
  `saleID` varchar(64) NOT NULL,
  `productID` varchar(64) NOT NULL,
  `discountType` enum('percentage','fixed') NOT NULL,
  `discountValue` decimal(10,2) NOT NULL DEFAULT 0.00,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `giftcards`
--

CREATE TABLE `giftcards` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `card_number_hmac` char(64) NOT NULL,
  `card_last4` char(4) NOT NULL,
  `pin_hash` varchar(255) NOT NULL,
  `currency` char(3) NOT NULL DEFAULT 'INR',
  `balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('active','redeemed','disabled','expired') NOT NULL DEFAULT 'active',
  `expires_at` datetime DEFAULT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `make_combo_items`
--

CREATE TABLE `make_combo_items` (
  `localID` int(11) NOT NULL,
  `comboID` varchar(255) NOT NULL,
  `productID` varchar(255) NOT NULL,
  `productName` varchar(255) NOT NULL,
  `featuredImage` varchar(500) DEFAULT NULL,
  `categories` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`categories`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `variationID` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `offers`
--

CREATE TABLE `offers` (
  `offerID` varchar(255) NOT NULL,
  `offerName` varchar(255) NOT NULL,
  `offerType` varchar(100) NOT NULL,
  `buyAt` int(11) DEFAULT NULL,
  `buyCount` int(11) NOT NULL DEFAULT 0,
  `getCount` int(11) NOT NULL DEFAULT 0,
  `offerMobileBanner` varchar(500) DEFAULT NULL,
  `offerBanner` varchar(500) DEFAULT NULL,
  `products` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`products`)),
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `orderDetail`
--

CREATE TABLE `orderDetail` (
  `orderID` int(11) NOT NULL,
  `uid` varchar(125) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `totalDiscount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `modified` tinyint(1) DEFAULT 0,
  `createdAt` datetime DEFAULT current_timestamp(),
  `txnID` varchar(500) NOT NULL,
  `addressID` varchar(125) NOT NULL,
  `paymentMode` varchar(50) NOT NULL DEFAULT 'cod',
  `trackingID` varchar(100) DEFAULT NULL,
  `deliveryCompany` varchar(100) DEFAULT NULL,
  `couponCode` varchar(50) DEFAULT NULL,
  `couponDiscount` decimal(10,2) DEFAULT 0.00,
  `merchantID` varchar(100) DEFAULT NULL,
  `orderStatus` varchar(50) DEFAULT 'pending',
  `referBy` varchar(255) DEFAULT NULL,
  `paymentStatus` varchar(100) DEFAULT 'pending',
  `coinsEarned` int(11) NOT NULL DEFAULT 0,
  `isWalletUsed` tinyint(1) NOT NULL DEFAULT 0,
  `paidWallet` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_combo_items`
--

CREATE TABLE `order_combo_items` (
  `comboItemID` int(11) NOT NULL,
  `comboID` varchar(125) NOT NULL,
  `productID` varchar(50) NOT NULL,
  `variationID` varchar(50) DEFAULT NULL,
  `productName` varchar(255) NOT NULL,
  `featuredImage` varchar(500) DEFAULT NULL,
  `variationName` varchar(255) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `quantity` int(11) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `orderItemID` int(11) NOT NULL,
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
  `featuredImage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`featuredImage`)),
  `comboID` varchar(125) DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `referBy` varchar(500) NOT NULL,
  `custom_inputs` text DEFAULT NULL,
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `brandID` varchar(100) DEFAULT 'inhouse',
  `trackingCode` varchar(200) DEFAULT NULL,
  `deliveryCompany` varchar(100) DEFAULT NULL,
  `itemStatus` varchar(100) DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `otp_sent`
--

CREATE TABLE `otp_sent` (
  `id` int(10) UNSIGNED NOT NULL,
  `otpHash` varchar(255) NOT NULL,
  `identifier` varchar(100) DEFAULT NULL,
  `type` enum('email','phone') DEFAULT 'phone',
  `sentOn` datetime NOT NULL DEFAULT current_timestamp(),
  `expiry` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `presale_booking_details`
--

CREATE TABLE `presale_booking_details` (
  `preBookingID` bigint(20) NOT NULL,
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
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `presale_booking_items`
--

CREATE TABLE `presale_booking_items` (
  `preBookingItemID` bigint(20) NOT NULL,
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
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `presale_details`
--

CREATE TABLE `presale_details` (
  `id` int(11) NOT NULL,
  `presaleGroupID` varchar(50) NOT NULL,
  `groupName` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `bannerImage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`bannerImage`)),
  `featuredImage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`featuredImage`)),
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
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `presale_group_products`
--

CREATE TABLE `presale_group_products` (
  `id` int(11) NOT NULL,
  `presaleGroupID` varchar(50) NOT NULL,
  `presaleProductID` varchar(50) NOT NULL,
  `displayOrder` int(11) DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `presale_products`
--

CREATE TABLE `presale_products` (
  `id` int(11) NOT NULL,
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
  `featuredImage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`featuredImage`)),
  `productAttributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`productAttributes`)),
  `categories` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`categories`)),
  `brand` varchar(255) DEFAULT NULL,
  `galleryImage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`galleryImage`)),
  `brandID` varchar(50) DEFAULT NULL,
  `custom_inputs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`custom_inputs`)),
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
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

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
  `allowCustomerImageUpload` tinyint(1) DEFAULT 0,
  `slug` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product_cross_sells`
--

CREATE TABLE `product_cross_sells` (
  `id` int(11) NOT NULL,
  `productID` varchar(50) NOT NULL,
  `crossSellProductID` varchar(50) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reviews`
--

CREATE TABLE `reviews` (
  `reviewID` int(11) NOT NULL,
  `productID` varchar(50) NOT NULL,
  `uid` varchar(50) NOT NULL,
  `orderID` int(11) DEFAULT NULL,
  `rating` int(11) NOT NULL CHECK (`rating` >= 1 and `rating` <= 5),
  `comment` text DEFAULT NULL,
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`images`)),
  `helpful_count` int(11) DEFAULT 0,
  `verified_purchase` tinyint(1) DEFAULT 0,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `review_helpful`
--

CREATE TABLE `review_helpful` (
  `reviewHelpfulID` int(11) NOT NULL,
  `reviewID` int(11) NOT NULL,
  `uid` varchar(50) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `review_replies`
--

CREATE TABLE `review_replies` (
  `replyID` int(11) NOT NULL,
  `reviewID` int(11) NOT NULL,
  `uid` varchar(50) NOT NULL,
  `reply` text NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `sessionID` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phonenumber` varchar(255) DEFAULT NULL,
  `deviceInfo` text DEFAULT NULL,
  `refreshToken` text NOT NULL,
  `expiry` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

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
  `gstin` varchar(15) DEFAULT NULL,
  `pendingPayment` decimal(10,2) NOT NULL DEFAULT 0.00,
  `verifiedEmail` tinyint(1) DEFAULT NULL,
  `verifiedPhone` tinyint(1) DEFAULT NULL,
  `uid` varchar(255) DEFAULT NULL,
  `referCode` varchar(50) DEFAULT NULL,
  `createdOn` datetime DEFAULT current_timestamp(),
  `role` varchar(255) DEFAULT NULL,
  `affiliate` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `variations`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `wishlist`
--

CREATE TABLE `wishlist` (
  `wishlistID` varchar(50) NOT NULL,
  `uid` varchar(50) NOT NULL,
  `productID` varchar(50) NOT NULL,
  `featuredImage` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`featuredImage`)),
  `regularPrice` decimal(10,2) NOT NULL,
  `salePrice` decimal(10,2) DEFAULT NULL,
  `categories` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`categories`)),
  `brand` varchar(100) DEFAULT NULL,
  `slug` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wishlistDetail`
--

CREATE TABLE `wishlistDetail` (
  `wishlistID` varchar(100) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `uid` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wishlist_items`
--

CREATE TABLE `wishlist_items` (
  `wishlistItemID` varchar(100) NOT NULL,
  `wishlistID` varchar(100) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `uid` varchar(100) NOT NULL,
  `productID` varchar(100) NOT NULL,
  `productType` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `address`
--
ALTER TABLE `address`
  ADD PRIMARY KEY (`addressID`);

--
-- Indexes for table `affiliateTransactions`
--
ALTER TABLE `affiliateTransactions`
  ADD PRIMARY KEY (`txnID`),
  ADD KEY `uid` (`uid`),
  ADD KEY `type` (`type`);

--
-- Indexes for table `affiliate_bank_accounts`
--
ALTER TABLE `affiliate_bank_accounts`
  ADD PRIMARY KEY (`bankAccountID`),
  ADD UNIQUE KEY `unique_account` (`uid`,`accountNumber`,`ifscCode`),
  ADD KEY `idx_uid` (`uid`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_uid_status` (`uid`,`status`),
  ADD KEY `idx_uid_default` (`uid`,`isDefault`),
  ADD KEY `idx_uid_approved` (`uid`,`status`,`isDefault`);

--
-- Indexes for table `attributes`
--
ALTER TABLE `attributes`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `brand_bank_details`
--
ALTER TABLE `brand_bank_details`
  ADD PRIMARY KEY (`bankDetailID`),
  ADD KEY `idx_brand` (`brandID`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_brand_status` (`brandID`,`status`);

--
-- Indexes for table `cartDetail`
--
ALTER TABLE `cartDetail`
  ADD PRIMARY KEY (`cartID`);

--
-- Indexes for table `cart_items`
--
ALTER TABLE `cart_items`
  ADD PRIMARY KEY (`cartItemID`),
  ADD KEY `idx_cart_items_custom_inputs` (`custom_inputs`(255)),
  ADD KEY `idx_cart_items_selected` (`selected`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`categoryID`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Indexes for table `coin_balance`
--
ALTER TABLE `coin_balance`
  ADD PRIMARY KEY (`uid`);

--
-- Indexes for table `coin_lots`
--
ALTER TABLE `coin_lots`
  ADD PRIMARY KEY (`lotID`),
  ADD KEY `idx_coin_lots_uid` (`uid`),
  ADD KEY `idx_coin_lots_expires` (`expiresAt`),
  ADD KEY `idx_coin_lots_uid_expires` (`uid`,`expiresAt`);

--
-- Indexes for table `coin_transactions`
--
ALTER TABLE `coin_transactions`
  ADD PRIMARY KEY (`txnID`),
  ADD KEY `idx_coin_txn_uid` (`uid`),
  ADD KEY `idx_coin_txn_type` (`type`);

--
-- Indexes for table `combo_item`
--
ALTER TABLE `combo_item`
  ADD PRIMARY KEY (`localID`);

--
-- Indexes for table `coupons`
--
ALTER TABLE `coupons`
  ADD PRIMARY KEY (`couponID`),
  ADD UNIQUE KEY `couponCode` (`couponCode`);

--
-- Indexes for table `flash_sale_details`
--
ALTER TABLE `flash_sale_details`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `saleID` (`saleID`);

--
-- Indexes for table `flash_sale_items`
--
ALTER TABLE `flash_sale_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `saleItemID` (`saleItemID`),
  ADD KEY `idx_fsi_sale` (`saleID`),
  ADD KEY `idx_fsi_product` (`productID`);

--
-- Indexes for table `giftcards`
--
ALTER TABLE `giftcards`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_giftcards_card_number_hmac` (`card_number_hmac`);

--
-- Indexes for table `make_combo_items`
--
ALTER TABLE `make_combo_items`
  ADD PRIMARY KEY (`localID`);

--
-- Indexes for table `offers`
--
ALTER TABLE `offers`
  ADD PRIMARY KEY (`offerID`);

--
-- Indexes for table `orderDetail`
--
ALTER TABLE `orderDetail`
  ADD PRIMARY KEY (`orderID`);

--
-- Indexes for table `order_combo_items`
--
ALTER TABLE `order_combo_items`
  ADD PRIMARY KEY (`comboItemID`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`orderItemID`);

--
-- Indexes for table `otp_sent`
--
ALTER TABLE `otp_sent`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_phoneNumber` (`identifier`);

--
-- Indexes for table `presale_booking_details`
--
ALTER TABLE `presale_booking_details`
  ADD PRIMARY KEY (`preBookingID`);

--
-- Indexes for table `presale_booking_items`
--
ALTER TABLE `presale_booking_items`
  ADD PRIMARY KEY (`preBookingItemID`),
  ADD KEY `idx_preBookingID` (`preBookingID`),
  ADD KEY `idx_productID` (`productID`);

--
-- Indexes for table `presale_details`
--
ALTER TABLE `presale_details`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `presaleGroupID` (`presaleGroupID`),
  ADD KEY `idx_presale_group_id` (`presaleGroupID`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_dates` (`startDate`,`endDate`),
  ADD KEY `idx_display` (`displayOrder`,`isFeatured`,`showOnHomepage`);

--
-- Indexes for table `presale_group_products`
--
ALTER TABLE `presale_group_products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_group_product` (`presaleGroupID`,`presaleProductID`),
  ADD KEY `idx_group` (`presaleGroupID`),
  ADD KEY `idx_product` (`presaleProductID`),
  ADD KEY `idx_display_order` (`presaleGroupID`,`displayOrder`);

--
-- Indexes for table `presale_products`
--
ALTER TABLE `presale_products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `presaleProductID` (`presaleProductID`),
  ADD KEY `idx_presale_product_id` (`presaleProductID`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_brand` (`brandID`),
  ADD KEY `idx_preSale_dates` (`preSaleStartDate`,`preSaleEndDate`),
  ADD KEY `idx_expected_delivery` (`expectedDeliveryDate`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`productID`),
  ADD UNIQUE KEY `idx_products_slug` (`slug`),
  ADD KEY `idx_products_custom_inputs` (`custom_inputs`(255)),
  ADD KEY `idx_products_slug_lookup` (`slug`);

--
-- Indexes for table `product_cross_sells`
--
ALTER TABLE `product_cross_sells`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_cross_sell` (`productID`,`crossSellProductID`),
  ADD KEY `idx_product` (`productID`),
  ADD KEY `idx_cross_sell_product` (`crossSellProductID`),
  ADD KEY `idx_product_cross_sell` (`productID`,`crossSellProductID`);

--
-- Indexes for table `reviews`
--
ALTER TABLE `reviews`
  ADD PRIMARY KEY (`reviewID`),
  ADD KEY `idx_product` (`productID`),
  ADD KEY `idx_uid` (`uid`),
  ADD KEY `idx_order` (`orderID`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created` (`createdAt`);

--
-- Indexes for table `review_helpful`
--
ALTER TABLE `review_helpful`
  ADD PRIMARY KEY (`reviewHelpfulID`),
  ADD UNIQUE KEY `unique_review_user` (`reviewID`,`uid`),
  ADD KEY `idx_review` (`reviewID`);

--
-- Indexes for table `review_replies`
--
ALTER TABLE `review_replies`
  ADD PRIMARY KEY (`replyID`),
  ADD KEY `idx_review` (`reviewID`),
  ADD KEY `idx_uid` (`uid`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`sessionID`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`username`),
  ADD UNIQUE KEY `emailID` (`emailID`);

--
-- Indexes for table `wishlist`
--
ALTER TABLE `wishlist`
  ADD PRIMARY KEY (`wishlistID`),
  ADD UNIQUE KEY `uid` (`uid`,`productID`);

--
-- Indexes for table `wishlistDetail`
--
ALTER TABLE `wishlistDetail`
  ADD PRIMARY KEY (`wishlistID`);

--
-- Indexes for table `wishlist_items`
--
ALTER TABLE `wishlist_items`
  ADD PRIMARY KEY (`wishlistItemID`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `affiliate_bank_accounts`
--
ALTER TABLE `affiliate_bank_accounts`
  MODIFY `bankAccountID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `attributes`
--
ALTER TABLE `attributes`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `brand_bank_details`
--
ALTER TABLE `brand_bank_details`
  MODIFY `bankDetailID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cartDetail`
--
ALTER TABLE `cartDetail`
  MODIFY `cartID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cart_items`
--
ALTER TABLE `cart_items`
  MODIFY `cartItemID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `categoryID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `coin_lots`
--
ALTER TABLE `coin_lots`
  MODIFY `lotID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `coin_transactions`
--
ALTER TABLE `coin_transactions`
  MODIFY `txnID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `combo_item`
--
ALTER TABLE `combo_item`
  MODIFY `localID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `flash_sale_details`
--
ALTER TABLE `flash_sale_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `flash_sale_items`
--
ALTER TABLE `flash_sale_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `giftcards`
--
ALTER TABLE `giftcards`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `make_combo_items`
--
ALTER TABLE `make_combo_items`
  MODIFY `localID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `orderDetail`
--
ALTER TABLE `orderDetail`
  MODIFY `orderID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_combo_items`
--
ALTER TABLE `order_combo_items`
  MODIFY `comboItemID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `orderItemID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `otp_sent`
--
ALTER TABLE `otp_sent`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `presale_booking_details`
--
ALTER TABLE `presale_booking_details`
  MODIFY `preBookingID` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `presale_booking_items`
--
ALTER TABLE `presale_booking_items`
  MODIFY `preBookingItemID` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `presale_details`
--
ALTER TABLE `presale_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `presale_group_products`
--
ALTER TABLE `presale_group_products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `presale_products`
--
ALTER TABLE `presale_products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `product_cross_sells`
--
ALTER TABLE `product_cross_sells`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reviews`
--
ALTER TABLE `reviews`
  MODIFY `reviewID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `review_helpful`
--
ALTER TABLE `review_helpful`
  MODIFY `reviewHelpfulID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `review_replies`
--
ALTER TABLE `review_replies`
  MODIFY `replyID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sessions`
--
ALTER TABLE `sessions`
  MODIFY `sessionID` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `flash_sale_items`
--
ALTER TABLE `flash_sale_items`
  ADD CONSTRAINT `fk_fsi_sale` FOREIGN KEY (`saleID`) REFERENCES `flash_sale_details` (`saleID`) ON DELETE CASCADE;

--
-- Constraints for table `presale_booking_items`
--
ALTER TABLE `presale_booking_items`
  ADD CONSTRAINT `presale_booking_items_ibfk_1` FOREIGN KEY (`preBookingID`) REFERENCES `presale_booking_details` (`preBookingID`) ON DELETE CASCADE;

--
-- Constraints for table `presale_group_products`
--
ALTER TABLE `presale_group_products`
  ADD CONSTRAINT `presale_group_products_ibfk_1` FOREIGN KEY (`presaleGroupID`) REFERENCES `presale_details` (`presaleGroupID`) ON DELETE CASCADE,
  ADD CONSTRAINT `presale_group_products_ibfk_2` FOREIGN KEY (`presaleProductID`) REFERENCES `presale_products` (`presaleProductID`) ON DELETE CASCADE;

--
-- Constraints for table `product_cross_sells`
--
ALTER TABLE `product_cross_sells`
  ADD CONSTRAINT `product_cross_sells_ibfk_1` FOREIGN KEY (`productID`) REFERENCES `products` (`productID`) ON DELETE CASCADE,
  ADD CONSTRAINT `product_cross_sells_ibfk_2` FOREIGN KEY (`crossSellProductID`) REFERENCES `products` (`productID`) ON DELETE CASCADE;

--
-- Constraints for table `review_helpful`
--
ALTER TABLE `review_helpful`
  ADD CONSTRAINT `review_helpful_ibfk_1` FOREIGN KEY (`reviewID`) REFERENCES `reviews` (`reviewID`) ON DELETE CASCADE;

--
-- Constraints for table `review_replies`
--
ALTER TABLE `review_replies`
  ADD CONSTRAINT `review_replies_ibfk_1` FOREIGN KEY (`reviewID`) REFERENCES `reviews` (`reviewID`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
