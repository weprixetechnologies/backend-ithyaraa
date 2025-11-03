const db = require('../utils/dbconnect');

// Runtime schema initialization removed; rely on migrations

async function ensureBalanceRow(uid) {
    await db.query(
        'INSERT INTO coin_balance (uid, balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE uid = uid',
        [uid]
    );
}

// Create pending coin transaction (order placed, not yet delivered)
async function createPendingCoins(uid, orderID, coins) {
    await ensureBalanceRow(uid);
    await db.query(
        `INSERT INTO coin_transactions (uid, type, coins, refType, refID) VALUES (?, 'pending', ?, 'order', ?)`,
        [uid, coins, String(orderID || '')]
    );
    // Don't credit balance yet - wait for delivery
    return true;
}

// Complete pending coins when order is delivered (convert to earned)
async function completePendingCoins(uid, orderID) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Find pending transaction for this order
        const [pending] = await connection.query(
            `SELECT txnID, coins FROM coin_transactions 
             WHERE uid = ? AND type = 'pending' AND refType = 'order' AND refID = ? 
             LIMIT 1 FOR UPDATE`,
            [uid, String(orderID)]
        );

        if (!pending || pending.length === 0) {
            await connection.rollback();
            return { success: false, message: 'No pending coins found for this order' };
        }

        const coins = pending[0].coins;
        const txnID = pending[0].txnID;

        // Create earn lot
        const earnedAt = new Date();
        const expiresAt = new Date(earnedAt.getTime() + 365 * 24 * 60 * 60 * 1000);
        const [lotRes] = await connection.query(
            `INSERT INTO coin_lots (uid, orderID, coinsTotal, coinsUsed, coinsExpired, earnedAt, expiresAt)
             VALUES (?, ?, ?, 0, 0, ?, ?)`,
            [uid, orderID, coins, earnedAt, expiresAt]
        );

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

// Reverse pending coins when order cancelled/returned
async function reversePendingCoins(uid, orderID) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Find pending transaction for this order
        const [pending] = await connection.query(
            `SELECT txnID, coins FROM coin_transactions 
             WHERE uid = ? AND type = 'pending' AND refType = 'order' AND refID = ? 
             LIMIT 1 FOR UPDATE`,
            [uid, String(orderID)]
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
    const [res] = await db.query(
        `INSERT INTO coin_lots (uid, orderID, coinsTotal, coinsUsed, coinsExpired, earnedAt, expiresAt)
         VALUES (?, ?, ?, 0, 0, ?, ?)`,
        [uid, orderID || null, coins, earnedAt, expiresAt]
    );
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
        const [lots] = await connection.query(
            `SELECT lotID, coinsTotal, coinsUsed, coinsExpired, expiresAt
             FROM coin_lots WHERE uid = ? AND (coinsTotal - coinsUsed - coinsExpired) > 0
             ORDER BY expiresAt ASC, earnedAt ASC
             FOR UPDATE`,
            [uid]
        );

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
    reversePendingCoins,
    getBalance,
    getHistory,
    redeemCoinsToWallet,
    expireDueLots
};


