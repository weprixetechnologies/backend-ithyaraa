const db = require('../utils/dbconnect');

const createTable = async () => {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS featured_blocks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                image_url VARCHAR(1024) NOT NULL,
                routeTo VARCHAR(255) DEFAULT 'shop',
                minPrice INT DEFAULT NULL,
                maxPrice INT DEFAULT NULL,
                category INT DEFAULT NULL,
                offer VARCHAR(255) DEFAULT NULL,
                position INT DEFAULT 0,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `;
        await db.query(sql);
        console.log('Table featured_blocks created or already exists.');
        process.exit(0);
    } catch (error) {
        console.error('Error creating table:', error);
        process.exit(1);
    }
};

createTable();
