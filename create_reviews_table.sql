-- Create reviews table for product ratings and comments
CREATE TABLE IF NOT EXISTS reviews (
    reviewID INT PRIMARY KEY AUTO_INCREMENT,
    productID VARCHAR(50) NOT NULL,
    uid VARCHAR(50) NOT NULL,
    orderID INT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    images JSON NULL,
    helpful_count INT DEFAULT 0,
    verified_purchase BOOLEAN DEFAULT FALSE,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_product (productID),
    INDEX idx_uid (uid),
    INDEX idx_order (orderID),
    INDEX idx_status (status),
    INDEX idx_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to track who found a review helpful
CREATE TABLE IF NOT EXISTS review_helpful (
    reviewHelpfulID INT PRIMARY KEY AUTO_INCREMENT,
    reviewID INT NOT NULL,
    uid VARCHAR(50) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_review_user (reviewID, uid),
    INDEX idx_review (reviewID),
    
    FOREIGN KEY (reviewID) REFERENCES reviews(reviewID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for review replies (nested comments)
CREATE TABLE IF NOT EXISTS review_replies (
    replyID INT PRIMARY KEY AUTO_INCREMENT,
    reviewID INT NOT NULL,
    uid VARCHAR(50) NOT NULL,
    reply TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_review (reviewID),
    INDEX idx_uid (uid),
    
    FOREIGN KEY (reviewID) REFERENCES reviews(reviewID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

