-- Admin → Brand notifications
-- Dashboard is the source of truth. Email is only a nudge.

-- 1) Notifications created by admin
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content_html MEDIUMTEXT NOT NULL COMMENT 'Sanitized rich HTML content (pasted from Word)',
    image_url TEXT NULL COMMENT 'Optional single image URL (existing upload system)',
    type ENUM('offer','deal','participation','general') NOT NULL DEFAULT 'general',
    created_by VARCHAR(255) NULL COMMENT 'Admin UID / identifier',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_type (type),
    INDEX idx_notifications_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Brand-specific deliveries and read tracking
CREATE TABLE IF NOT EXISTS brand_notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    notification_id BIGINT UNSIGNED NOT NULL,
    brand_id VARCHAR(255) NOT NULL COMMENT 'Brand UID from users.uid',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    read_at DATETIME NULL,
    email_status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
    email_sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_brand_notifications_notification
        FOREIGN KEY (notification_id) REFERENCES notifications(id)
        ON DELETE CASCADE,
    INDEX idx_brand_notifications_notification (notification_id),
    INDEX idx_brand_notifications_brand (brand_id),
    INDEX idx_brand_notifications_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

