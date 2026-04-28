const db = require('../utils/dbconnect');

const createTable = async () => {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS featured_coupons (
                id INT AUTO_INCREMENT PRIMARY KEY,
                popupImage VARCHAR(1024) NOT NULL,
                iconImage VARCHAR(1024) NOT NULL,
                isActive TINYINT(1) DEFAULT 1,
                couponCode VARCHAR(50) DEFAULT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `;
        await db.query(sql);
        console.log('Table featured_coupons created or already exists.');
        process.exit(0);
    } catch (error) {
        console.error('Error creating table:', error);
        process.exit(1);
    }
};

createTable();
