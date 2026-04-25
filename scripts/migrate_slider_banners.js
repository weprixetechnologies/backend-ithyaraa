const db = require('../utils/dbconnect');

async function migrate() {
    try {
        console.log('Starting migration for home_slider_banners...');

        // 1. Alter table to add new columns
        await db.query(`
            ALTER TABLE home_slider_banners 
            ADD COLUMN routeTo VARCHAR(255) DEFAULT 'shop',
            ADD COLUMN minPrice DECIMAL(10, 2) DEFAULT NULL,
            ADD COLUMN maxPrice DECIMAL(10, 2) DEFAULT NULL,
            ADD COLUMN category VARCHAR(255) DEFAULT NULL,
            ADD COLUMN offer VARCHAR(255) DEFAULT NULL
        `);
        console.log('Table home_slider_banners altered successfully.');

        // 2. Update existing rows to have routeTo = 'shop' (though default covers it)
        await db.query(`UPDATE home_slider_banners SET routeTo = 'shop' WHERE routeTo IS NULL`);
        console.log('Existing rows updated.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Columns already exist. Skipping alter table.');
            process.exit(0);
        } else {
            console.error('Migration failed:', error);
            process.exit(1);
        }
    }
}

migrate();
