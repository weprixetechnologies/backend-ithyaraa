-- Create brand_bank_details table
CREATE TABLE IF NOT EXISTS brand_bank_details (
    bankDetailID INT PRIMARY KEY AUTO_INCREMENT,
    brandID VARCHAR(50) NOT NULL,
    accountHolderName VARCHAR(255) NOT NULL,
    accountNumber VARCHAR(50) NOT NULL,
    ifscCode VARCHAR(20) NOT NULL,
    bankName VARCHAR(255) NOT NULL,
    branchName VARCHAR(255) NULL,
    panNumber VARCHAR(20) NULL,
    gstin VARCHAR(20) NULL,
    address TEXT NULL,
    status ENUM('pending', 'active', 'rejected') DEFAULT 'pending',
    submittedBy VARCHAR(50) NULL COMMENT 'uid of who submitted (brand or admin)',
    approvedBy VARCHAR(50) NULL COMMENT 'admin uid who approved',
    rejectedBy VARCHAR(50) NULL COMMENT 'admin uid who rejected',
    rejectionReason TEXT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approvedAt TIMESTAMP NULL,
    rejectedAt TIMESTAMP NULL,
    
    INDEX idx_brand (brandID),
    INDEX idx_status (status),
    INDEX idx_brand_status (brandID, status),
    FOREIGN KEY (brandID) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

