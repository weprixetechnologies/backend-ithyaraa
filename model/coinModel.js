const db = require('../utils/dbconnect');

// Runtime schema initialization removed; rely on migrations

async function ensureBalanceRow(uid) {
    await db.query(
        'INSERT INTO coin_balance (uid, balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE uid = uid',
        [uid]
    );
}

// Create pending coin transaction (order placed, not yet delivered)
async function createPendingCoins(uid, orderID, coins, refType = 'order') {
    await ensureBalanceRow(uid);
    await db.query(
        `INSERT INTO coin_transactions (uid, type, coins, refType, refID) VALUES (?, 'pending', ?, ?, ?)`,
        [uid, coins, refType, String(orderID || '')]
    );
    // Don't credit balance yet - wait for delivery
    return true;
}

// Complete pending coins when order is delivered (convert to earned)
async function completePendingCoins(uid, orderID, refType = 'order') {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Find pending transaction for this order/presale booking
        const [pending] = await connection.query(
            `SELECT txnID, coins FROM coin_transactions 
             WHERE uid = ? AND type = 'pending' AND refType = ? AND refID = ? 
             LIMIT 1 FOR UPDATE`,
            [uid, refType, String(orderID)]
        );

        if (!pending || pending.length === 0) {
            await connection.rollback();
            return { success: false, message: 'No pending coins found for this order' };
        }

        const coins = pending[0].coins;
        const txnID = pending[0].txnID;

        // Create earn lot
        // Coins are credited instantly but become redeemable after 7 days (return period)
        const earnedAt = new Date();
        const expiresAt = new Date(earnedAt.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days expiry
        const redeemableAt = new Date(earnedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days redemption hold
        
        // Try to insert with redeemableAt, fall back if column doesn't exist
        let lotRes;
        try {
            [lotRes] = await connection.query(
                `INSERT INTO coin_lots (uid, orderID, coinsTotal, coinsUsed, coinsExpired, earnedAt, expiresAt, redeemableAt)
                 VALUES (?, ?, ?, 0, 0, ?, ?, ?)`,
                [uid, orderID, coins, earnedAt, expiresAt, redeemableAt]
            );
        } catch (error) {
            // If column doesn't exist yet, insert without redeemableAt (backward compatibility)
            if (error.message && error.message.includes('redeemableAt')) {
                console.warn('redeemableAt column not found, inserting without it (migration may not be run yet)');
                [lotRes] = await connection.query(
            `INSERT INTO coin_lots (uid, orderID, coinsTotal, coinsUsed, coinsExpired, earnedAt, expiresAt)
             VALUES (?, ?, ?, 0, 0, ?, ?)`,
            [uid, orderID, coins, earnedAt, expiresAt]
        );
            } else {
                throw error;
            }
        }

        // Update transaction from pending to earn
        await connection.query(
            `UPDATE coin_transactions SET type = 'earn' WHERE txnID = ?`,
            [txnID]
        );

        // Credit balance
        await connection.query(`UPDATE coin_balance SET balance = balance + ? WHERE uid = ?`, [coins, uid]);

        await connection.commit();
        return { success: true, lotID: lotRes.insertId };
    } catch (e) {
        await connection.rollback();
        throw e;
    } finally {
        connection.release();
    }
}

// Cancel pending coins when payment fails (different from reversal which is for returns)
async function cancelPendingCoins(uid, orderID, refType = 'order') {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Find pending transaction for this order/presale booking
        const [pending] = await connection.query(
            `SELECT txnID, coins FROM coin_transactions 
             WHERE uid = ? AND type = 'pending' AND refType = ? AND refID = ? 
             LIMIT 1 FOR UPDATE`,
            [uid, refType, String(orderID)]
        );

        if (!pending || pending.length === 0) {
            await connection.rollback();
            return { success: false, message: 'No pending coins found for this order' };
        }

        const coins = pending[0].coins;
        const txnID = pending[0].txnID;

        // Update transaction from pending to cancelled
        await connection.query(
            `UPDATE coin_transactions SET type = 'cancelled' WHERE txnID = ?`,
            [txnID]
        );

        await connection.commit();
        return { success: true };
    } catch (e) {
        await connection.rollback();
        throw e;
    } finally {
        connection.release();
    }
}

// Reverse pending coins when order cancelled/returned (for returns, not payment failures)
async function reversePendingCoins(uid, orderID, refType = 'order') {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Find pending transaction for this order/presale booking
        const [pending] = await connection.query(
            `SELECT txnID, coins FROM coin_transactions 
             WHERE uid = ? AND type = 'pending' AND refType = ? AND refID = ? 
             LIMIT 1 FOR UPDATE`,
            [uid, refType, String(orderID)]
        );

        if (!pending || pending.length === 0) {
            await connection.rollback();
            return { success: false, message: 'No pending coins found for this order' };
        }

        const coins = pending[0].coins;
        const txnID = pending[0].txnID;

        // Update transaction from pending to reversal
        await connection.query(
            `UPDATE coin_transactions SET type = 'reversal' WHERE txnID = ?`,
            [txnID]
        );

        await connection.commit();
        return { success: true };
    } catch (e) {
        await connection.rollback();
        throw e;
    } finally {
        connection.release();
    }
}

async function createEarnLot(uid, orderID, coins, earnedAt, expiresAt) {
    await ensureBalanceRow(uid);
    // Coins are credited instantly but become redeemable after 7 days (return period)
    const redeemableAt = new Date(earnedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days redemption hold
    
    // Try to insert with redeemableAt, fall back if column doesn't exist
    let res;
    try {
        [res] = await db.query(
            `INSERT INTO coin_lots (uid, orderID, coinsTotal, coinsUsed, coinsExpired, earnedAt, expiresAt, redeemableAt)
             VALUES (?, ?, ?, 0, 0, ?, ?, ?)`,
            [uid, orderID || null, coins, earnedAt, expiresAt, redeemableAt]
        );
    } catch (error) {
        // If column doesn't exist yet, insert without redeemableAt (backward compatibility)
        if (error.message && error.message.includes('redeemableAt')) {
            console.warn('redeemableAt column not found, inserting without it (migration may not be run yet)');
            [res] = await db.query(
        `INSERT INTO coin_lots (uid, orderID, coinsTotal, coinsUsed, coinsExpired, earnedAt, expiresAt)
         VALUES (?, ?, ?, 0, 0, ?, ?)`,
        [uid, orderID || null, coins, earnedAt, expiresAt]
    );
        } else {
            throw error;
        }
    }
    await db.query(
        `INSERT INTO coin_transactions (uid, type, coins, refType, refID) VALUES (?, 'earn', ?, 'order', ?)`
        , [uid, coins, String(orderID || '')]
    );
    await db.query(`UPDATE coin_balance SET balance = balance + ? WHERE uid = ?`, [coins, uid]);
    return res.insertId;
}

async function getBalance(uid) {
    await ensureBalanceRow(uid);
    const [rows] = await db.query(`SELECT balance FROM coin_balance WHERE uid = ?`, [uid]);
    return rows[0]?.balance || 0;
}

// Get redeemable balance (coins that can be redeemed now, after 7-day hold period)
async function getRedeemableBalance(uid) {
    await ensureBalanceRow(uid);
    try {
        const now = new Date();
        // Check if redeemableAt column exists by trying to query it
        // If column doesn't exist, return total balance (backward compatibility)
        const [rows] = await db.query(
            `SELECT COALESCE(SUM(coinsTotal - coinsUsed - coinsExpired), 0) as redeemableBalance
             FROM coin_lots 
             WHERE uid = ? 
             AND (coinsTotal - coinsUsed - coinsExpired) > 0
             AND (redeemableAt IS NULL OR redeemableAt <= ?)`,
            [uid, now]
        );
        return rows[0]?.redeemableBalance || 0;
    } catch (error) {
        // If column doesn't exist yet (migration not run), return total balance
        if (error.message && error.message.includes('redeemableAt')) {
            console.warn('redeemableAt column not found, returning total balance (migration may not be run yet)');
            return await getBalance(uid);
        }
        throw error;
    }
}

async function getHistory(uid, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [rows] = await db.query(
        `SELECT txnID, type, coins, refType, refID, meta, createdAt
         FROM coin_transactions WHERE uid = ?
         ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        [uid, Number(limit), Number(offset)]
    );
    const [[{ total } = { total: 0 }]] = await db.query(
        `SELECT COUNT(*) as total FROM coin_transactions WHERE uid = ?`,
        [uid]
    );
    return { rows, page, limit, total };
}

async function redeemCoinsToWallet(uid, coins) {
    // FIFO redemption from non-expired lots
    await ensureBalanceRow(uid);
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [balRows] = await connection.query(`SELECT balance FROM coin_balance WHERE uid = ? FOR UPDATE`, [uid]);
        const curr = balRows[0]?.balance || 0;
        if (coins <= 0 || curr < coins) {
            throw new Error('Insufficient coin balance');
        }

        let remaining = coins;
        const now = new Date();
        // Only select lots that are redeemable (redeemableAt <= now) and have available coins
        // Handle backward compatibility if redeemableAt column doesn't exist
        let lots;
        try {
            [lots] = await connection.query(
                `SELECT lotID, coinsTotal, coinsUsed, coinsExpired, expiresAt, redeemableAt
                 FROM coin_lots 
                 WHERE uid = ? 
                 AND (coinsTotal - coinsUsed - coinsExpired) > 0
                 AND (redeemableAt IS NULL OR redeemableAt <= ?)
                 ORDER BY expiresAt ASC, earnedAt ASC
                 FOR UPDATE`,
                [uid, now]
            );
        } catch (error) {
            // If column doesn't exist yet, fall back to old behavior (all available coins)
            if (error.message && error.message.includes('redeemableAt')) {
                console.warn('redeemableAt column not found, using all available coins (migration may not be run yet)');
                [lots] = await connection.query(
            `SELECT lotID, coinsTotal, coinsUsed, coinsExpired, expiresAt
                     FROM coin_lots 
                     WHERE uid = ? 
                     AND (coinsTotal - coinsUsed - coinsExpired) > 0
             ORDER BY expiresAt ASC, earnedAt ASC
             FOR UPDATE`,
            [uid]
        );
            } else {
                throw error;
            }
        }

        for (const lot of lots) {
            if (remaining <= 0) break;
            const available = lot.coinsTotal - lot.coinsUsed - lot.coinsExpired;
            const useNow = Math.min(available, remaining);
            if (useNow > 0) {
                await connection.query(
                    `UPDATE coin_lots SET coinsUsed = coinsUsed + ? WHERE lotID = ?`,
                    [useNow, lot.lotID]
                );
                remaining -= useNow;
            }
        }

        if (remaining > 0) {
            throw new Error('Failed to allocate coins from lots');
        }

        await connection.query(
            `INSERT INTO coin_transactions (uid, type, coins, refType) VALUES (?, 'redeem', ?, 'wallet')`,
            [uid, coins]
        );
        // 1 coin = ₹1 wallet credit (adjust if business rule changes)
        await connection.query(`UPDATE coin_balance SET balance = balance - ? WHERE uid = ?`, [coins, uid]);
        await connection.query(`UPDATE users SET balance = balance + ? WHERE uid = ?`, [coins, uid]);

        await connection.commit();
        return { success: true };
    } catch (e) {
        await connection.rollback();
        throw e;
    } finally {
        connection.release();
    }
}

async function expireDueLots(now = new Date()) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [due] = await connection.query(
            `SELECT lotID, uid, coinsTotal, coinsUsed, coinsExpired FROM coin_lots WHERE expiresAt <= ? AND (coinsTotal - coinsUsed - coinsExpired) > 0 FOR UPDATE`,
            [now]
        );
        for (const lot of due) {
            const remaining = lot.coinsTotal - lot.coinsUsed - lot.coinsExpired;
            if (remaining > 0) {
                await connection.query(`UPDATE coin_lots SET coinsExpired = coinsExpired + ? WHERE lotID = ?`, [remaining, lot.lotID]);
                await connection.query(`INSERT INTO coin_transactions (uid, type, coins, refType, refID) VALUES (?, 'expire', ?, 'lot', ?)`, [lot.uid, remaining, String(lot.lotID)]);
                await connection.query(`UPDATE coin_balance SET balance = balance - ? WHERE uid = ?`, [remaining, lot.uid]);
            }
        }
        await connection.commit();
        return { expiredLots: due.length };
    } catch (e) {
        await connection.rollback();
        throw e;
    } finally {
        connection.release();
    }
}

module.exports = {
    createEarnLot,
    createPendingCoins,
    completePendingCoins,
    cancelPendingCoins,
    reversePendingCoins,
    getBalance,
    getRedeemableBalance,
    getHistory,
    redeemCoinsToWallet,
    expireDueLots
};


