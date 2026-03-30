const db = require('../utils/dbconnect');

async function cleanup() {
    try {
        console.log('Dropping old settlement tables...');
        // Drop FK first
        await db.execute('ALTER TABLE settlement_payments DROP FOREIGN KEY fk_settlement_payments_settlement').catch(e => console.log('FK drop failed (might not exist)'));
        await db.execute('DROP TABLE IF EXISTS settlement_payments');
        await db.execute('DROP TABLE IF EXISTS brand_settlements');

        console.log('Resetting settlement columns on order_items...');
        await db.execute("UPDATE order_items SET settlementStatus = 'unsettled', settlementID = NULL, wasCarriedForward = 0");

        console.log('Modifying settlementStatus enum...');
        await db.execute("ALTER TABLE order_items MODIFY COLUMN settlementStatus ENUM('unsettled','included','deducted','carried_forward') DEFAULT 'unsettled'");

        console.log('Database cleanup completed successfully.');
    } catch (error) {
        console.error('Cleanup failed:', error);
    } finally {
        // Not closing pool as it might be shared or not necessary for small script
        process.exit();
    }
}

cleanup();
