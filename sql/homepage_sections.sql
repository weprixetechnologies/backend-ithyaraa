-- Homepage Sections Table Schema
-- This table stores dynamic homepage banner/card sections that can be managed by admin

CREATE TABLE IF NOT EXISTS homepage_sections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NULL,
    image TEXT NOT NULL COMMENT 'Image URL',
    link TEXT NULL COMMENT 'Fallback link',
    routeTo VARCHAR(255) NULL COMMENT 'Frontend route name (e.g., shop, category)',
    filters JSON NULL COMMENT 'Shop filters object (type, categoryID, offerID, minPrice, maxPrice, sortBy, etc.)',
    fallbackLink TEXT NULL COMMENT 'Constructed link: FRONTEND_URL/routeTo?filters',
    position INT NOT NULL DEFAULT 0 COMMENT 'Order on homepage',
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_position (position),
    INDEX idx_isActive (isActive),
    INDEX idx_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example filters JSON structure:
-- {
--   "type": "customproduct",
--   "categoryID": "CAT123",
--   "offerID": "OFFER456",
--   "minPrice": 100,
--   "maxPrice": 500,
--   "sortBy": "price_low_to_high"
-- }
