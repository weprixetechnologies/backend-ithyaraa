CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(255) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed initial shipping fee and login image
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('shipping_fee', '50');
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('login_image', 'https://images.bewakoof.com/web/rm-login-desk-v2.jpg');
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('login_image_mobile', 'https://images.bewakoof.com/web/rm-login-mobile-v3.jpg?dt=23:10:2024:15');
