const db = require('../utils/dbconnect');

async function createTable() {
    try {
        console.log('Creating brand_applications table if missing...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS brand_applications (
              id                    INT AUTO_INCREMENT PRIMARY KEY,
              ref_id                VARCHAR(30)  NOT NULL UNIQUE,
              brand_name            VARCHAR(255) NOT NULL,
              website               VARCHAR(500) NOT NULL,
              product_type          VARCHAR(50)  NOT NULL DEFAULT 'fashion',
              address               TEXT         NOT NULL,
              interests             JSON         NOT NULL,
              partnership_type      JSON         DEFAULT NULL,
              dropship_status       VARCHAR(20)  DEFAULT 'no',
              monthly_order_volume  VARCHAR(100) DEFAULT NULL,
              goals                 TEXT         DEFAULT NULL,
              lookbook_name         VARCHAR(500) DEFAULT NULL,
              lookbook_url          TEXT         DEFAULT NULL,
              contact_name          VARCHAR(255) NOT NULL,
              contact_position      VARCHAR(255) DEFAULT NULL,
              contact_email         VARCHAR(255) NOT NULL,
              contact_phone         VARCHAR(50)  NOT NULL,
              consent               TINYINT(1)   NOT NULL DEFAULT 0,
              status                ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
              brand_uid             VARCHAR(100) DEFAULT NULL,
              submitted_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
              reviewed_at           DATETIME     DEFAULT NULL,
              reviewed_by           VARCHAR(100) DEFAULT NULL,
              notes                 TEXT         DEFAULT NULL,
              INDEX idx_status (status),
              INDEX idx_contact_email (contact_email),
              INDEX idx_submitted_at (submitted_at DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('brand_applications table created / verified successfully.');
    } catch (error) {
        console.error('Failed to create brand_applications table:', error);
    } finally {
        process.exit();
    }
}

createTable();
