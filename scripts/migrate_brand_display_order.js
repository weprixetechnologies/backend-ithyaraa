const db = require('../utils/dbconnect');

async function migrate() {
    try {
        console.log('[Migration] Checking brandDisplayOrder column in products table...');
        
        const [columns] = await db.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'products' 
               AND COLUMN_NAME = 'brandDisplayOrder'`
        );

        if (columns.length === 0) {
            console.log('[Migration] Adding brandDisplayOrder column to products...');
            await db.query(
                `ALTER TABLE products ADD COLUMN brandDisplayOrder INT DEFAULT 0`
            );
            console.log('[Migration] brandDisplayOrder column added.');
        } else {
            console.log('[Migration] brandDisplayOrder column already exists.');
        }

        // Check index
        const [indexes] = await db.query(
            `SHOW INDEX FROM products WHERE Key_name = 'idx_products_brand_display_order'`
        );

        if (indexes.length === 0) {
            console.log('[Migration] Adding index idx_products_brand_display_order...');
            await db.query(
                `ALTER TABLE products ADD INDEX idx_products_brand_display_order (brandID, brandDisplayOrder)`
            );
            console.log('[Migration] Index added.');
        } else {
            console.log('[Migration] Index idx_products_brand_display_order already exists.');
        }

        console.log('[Migration] ✅ Migration completed successfully.');
        if (require.main === module) process.exit(0);
    } catch (error) {
        console.error('[Migration] ❌ Migration failed:', error);
        if (require.main === module) process.exit(1);
    }
}

if (require.main === module) {
    migrate();
}

module.exports = migrate;
