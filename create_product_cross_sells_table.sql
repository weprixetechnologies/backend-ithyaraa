-- Create product_cross_sells table for cross-sell product mappings
CREATE TABLE IF NOT EXISTS product_cross_sells (
    id INT PRIMARY KEY AUTO_INCREMENT,
    productID VARCHAR(50) NOT NULL,
    crossSellProductID VARCHAR(50) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (productID) REFERENCES products(productID) ON DELETE CASCADE,
    FOREIGN KEY (crossSellProductID) REFERENCES products(productID) ON DELETE CASCADE,
    
    -- Prevent duplicate mappings
    UNIQUE KEY unique_cross_sell (productID, crossSellProductID),
    
    -- Indexes for optimized lookup
    INDEX idx_product (productID),
    INDEX idx_cross_sell_product (crossSellProductID),
    INDEX idx_product_cross_sell (productID, crossSellProductID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

