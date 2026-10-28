const fs = require('fs');
const path = require('path');
const db = require('../utils/dbconnect');

async function runMegamenuMigration() {
    console.log('[Migration] Starting Mega Menu Products migration...');

    try {
        // 1. Check if column already exists
        const [existing] = await db.query(
            `SELECT COLUMN_NAME, DATA_TYPE 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'categories' 
               AND COLUMN_NAME = 'megamenuProducts'`
        );

        if (existing && existing.length > 0) {
            console.log('✓ Column `megamenuProducts` already exists on `categories` table (type: ' + existing[0].DATA_TYPE + '). No action required.');
            process.exit(0);
        }

        // 2. Read SQL migration file
        const sqlPath = path.join(__dirname, '../migrations/2026_10_28_add_megamenu_products_to_categories.sql');
        let sql = '';
        if (fs.existsSync(sqlPath)) {
            sql = fs.readFileSync(sqlPath, 'utf8');
        } else {
            sql = 'ALTER TABLE categories ADD COLUMN megamenuProducts JSON DEFAULT NULL;';
        }

        console.log('[Migration] Executing query:');
        console.log(sql.trim());

        await db.query(sql);

        // 3. Verify column was created
        const [verified] = await db.query(
            `SELECT COLUMN_NAME, DATA_TYPE 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'categories' 
               AND COLUMN_NAME = 'megamenuProducts'`
        );

        if (verified && verified.length > 0) {
            console.log('✓ Success! Column `megamenuProducts` (' + verified[0].DATA_TYPE + ') successfully added to `categories` table.');
        } else {
            console.warn('⚠ Migration executed, but column check returned empty. Please verify table permissions.');
        }

        process.exit(0);
    } catch (error) {
        // If MySQL reports duplicate column (e.g., error code 1060), treat as success
        if (error.errno === 1060 || error.code === 'ER_DUP_FIELDNAME') {
            console.log('✓ Column `megamenuProducts` already exists on `categories` table.');
            process.exit(0);
        }

        console.error('✗ Migration failed with error:', error.message);
        process.exit(1);
    }
}

runMegamenuMigration();
