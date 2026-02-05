-- Newsletter system tables

-- 1) Subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(320) NOT NULL,
    status ENUM('active','unsubscribed','bounced') NOT NULL DEFAULT 'active',
    subscribed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at DATETIME NULL,
    last_email_sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_newsletter_subscribers_email (email),
    KEY idx_newsletter_subscribers_status (status),
    KEY idx_newsletter_subscribers_email_status (email, status)
);

-- 2) Newsletters
CREATE TABLE IF NOT EXISTS newsletters (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content_html MEDIUMTEXT NOT NULL,
    content_text MEDIUMTEXT NULL,
    status ENUM('draft','scheduled','sent') NOT NULL DEFAULT 'draft',
    scheduled_at DATETIME NULL,
    sent_at DATETIME NULL,
    created_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_newsletters_status (status),
    KEY idx_newsletters_sent_at (sent_at)
);

-- 3) Newsletter Deliveries
CREATE TABLE IF NOT EXISTS newsletter_deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    newsletter_id BIGINT UNSIGNED NOT NULL,
    subscriber_id BIGINT UNSIGNED NOT NULL,
    status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
    error_message TEXT NULL,
    sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_deliveries_newsletter
        FOREIGN KEY (newsletter_id) REFERENCES newsletters(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_deliveries_subscriber
        FOREIGN KEY (subscriber_id) REFERENCES newsletter_subscribers(id)
        ON DELETE CASCADE,
    KEY idx_deliveries_newsletter (newsletter_id),
    KEY idx_deliveries_subscriber (subscriber_id),
    KEY idx_deliveries_status (status)
);

