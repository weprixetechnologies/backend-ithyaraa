const db = require('../utils/dbconnect');

/**
 * Migration script for Guest Cart optimization.
 * 1. Adds index on `cartDetail.uid` if missing (critical for fast cart retrieval by user or guest session token).
 * 2. Adds composite index on `cart_items(cartID, uid)` if missing.
 * 3. Provides optional cleanup routine for abandoned guest carts older than 30 days.
 */
async function runGuestCartMigration() {
    console.log('[Migration] Starting Guest Cart database optimization migration...');

    try {
        // 1. Check index on cartDetail(uid)
        const [cartDetailIndexes] = await db.query(
            `SHOW INDEX FROM cartDetail WHERE Column_name = 'uid'`
        );

        if (!cartDetailIndexes || cartDetailIndexes.length === 0) {
            console.log('[Migration] Creating index `idx_cartDetail_uid` on cartDetail(uid)...');
            await db.query(`ALTER TABLE cartDetail ADD INDEX idx_cartDetail_uid (uid)`);
            console.log('✓ Created index `idx_cartDetail_uid` on cartDetail(uid).');
        } else {
            console.log('✓ Index on `cartDetail(uid)` already exists.');
        }

        // 2. Check index on cart_items(cartID, uid)
        const [cartItemsIndexes] = await db.query(
            `SHOW INDEX FROM cart_items WHERE Key_name = 'idx_cart_items_cart_uid'`
        );

        if (!cartItemsIndexes || cartItemsIndexes.length === 0) {
            console.log('[Migration] Creating composite index `idx_cart_items_cart_uid` on cart_items(cartID, uid)...');
            await db.query(`ALTER TABLE cart_items ADD INDEX idx_cart_items_cart_uid (cartID, uid)`);
            console.log('✓ Created composite index `idx_cart_items_cart_uid` on cart_items(cartID, uid).');
        } else {
            console.log('✓ Index `idx_cart_items_cart_uid` on cart_items already exists.');
        }

        // 3. Clean up abandoned guest carts older than 30 days (optional sanity check)
        const [staleCarts] = await db.query(
            `SELECT COUNT(*) AS count FROM cartDetail 
             WHERE uid LIKE 'g_%' AND updatedAt < NOW() - INTERVAL 30 DAY`
        );

        const staleCount = staleCarts[0]?.count || 0;
        if (staleCount > 0) {
            console.log(`[Info] Found ${staleCount} stale guest cart(s) older than 30 days. Cleaning up...`);
            await db.query(
                `DELETE FROM cart_items WHERE uid LIKE 'g_%' AND cartID IN (
                    SELECT cartID FROM (
                        SELECT cartID FROM cartDetail 
                        WHERE uid LIKE 'g_%' AND updatedAt < NOW() - INTERVAL 30 DAY
                    ) AS t
                )`
            );
            await db.query(
                `DELETE FROM cartDetail WHERE uid LIKE 'g_%' AND updatedAt < NOW() - INTERVAL 30 DAY`
            );
            console.log(`✓ Cleaned up ${staleCount} expired guest carts.`);
        } else {
            console.log('✓ No stale guest carts (>30 days) to purge.');
        }

        console.log('✓ Guest Cart migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('✗ Guest Cart migration failed:', error.message);
        process.exit(1);
    }
}

runGuestCartMigration();
