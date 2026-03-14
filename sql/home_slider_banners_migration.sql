-- Home page slider banners (mobile 1:1 and desktop 1470:489)
-- Images are uploaded to BunnyCDN; this table stores URLs and order.

CREATE TABLE IF NOT EXISTS home_slider_banners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('mobile', 'desktop') NOT NULL COMMENT 'mobile=1:1, desktop=1470:489',
    image_url VARCHAR(1024) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_type_position (type, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
