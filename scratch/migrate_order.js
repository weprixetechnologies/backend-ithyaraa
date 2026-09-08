const db = require('../utils/dbconnect');

async function run() {
    try {
        const [columns] = await db.query('DESCRIBE categories');
        const hasOrderCol = columns.some(c => c.Field === 'order' || c.Field === 'displayOrder' || c.Field === 'sortOrder');
        console.log('Existing order column exists:', hasOrderCol);
        if (!hasOrderCol) {
            console.log('Adding `order` column to categories table...');
            await db.query('ALTER TABLE categories ADD COLUMN `order` INT DEFAULT 0');
            console.log('Column `order` added successfully.');
            
            const [rows] = await db.query('SELECT categoryID FROM categories ORDER BY categoryID ASC');
            for (let i = 0; i < rows.length; i++) {
                await db.query('UPDATE categories SET `order` = ? WHERE categoryID = ?', [i + 1, rows[i].categoryID]);
            }
            console.log(`Initialized order for ${rows.length} existing categories.`);
        } else {
            console.log('Order column already exists in categories table.');
        }
        process.exit(0);
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    }
}

run();
