const db = require('./utils/dbconnect');

async function migrate() {
    try {
        console.log('Adding shippingCharge column to users table...');
        // Using db (which is pool.promise())
        await db.query('ALTER TABLE users ADD COLUMN shippingCharge DECIMAL(10,2) DEFAULT 0.00 AFTER balance');
        console.log('Successfully added shippingCharge column.');
    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column shippingCharge already exists.');
        } else {
            console.error('Error during migration:', err);
        }
    } finally {
        // We don't necessarily need to end the pool if it's the main app pool, 
        // but for a standalone script, we might. 
        // However, dbconnect exports pool.promise(), so we can't easily call end() on the pool itself without ref the pool.
        process.exit(0);
    }
}

migrate();
