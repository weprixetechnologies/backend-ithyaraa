const express = require('express');
const router = express.Router();
const db = require('../../utils/dbconnect');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

// All routes require admin auth
router.use(authAdminMiddleware.verifyAccessToken);

// GET /api/admin/coins/transactions
// Advanced filters: uid, type, refType, refID, minCoins, maxCoins, startDate, endDate, sortBy, sortDir, page, limit
router.get('/transactions', async (req, res) => {
    try {
        const {
            uid,
            type, // earn|redeem|expire|reversal|pending
            refType,
            refID,
            minCoins,
            maxCoins,
            startDate,
            endDate,
            sortBy = 'createdAt',
            sortDir = 'DESC',
            page = 1,
            limit = 20
        } = req.query;

        const allowedSort = new Set(['createdAt', 'coins', 'type']);
        const sortCol = allowedSort.has(String(sortBy)) ? String(sortBy) : 'createdAt';
        const sortDirection = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const where = [];
        const params = [];

        if (uid) { where.push('ct.uid = ?'); params.push(uid); }
        if (type) { where.push('ct.type = ?'); params.push(type); }
        if (refType) { where.push('ct.refType = ?'); params.push(refType); }
        if (refID) { where.push('ct.refID = ?'); params.push(refID); }
        if (minCoins) { where.push('ct.coins >= ?'); params.push(Number(minCoins)); }
        if (maxCoins) { where.push('ct.coins <= ?'); params.push(Number(maxCoins)); }
        if (startDate) { where.push('ct.createdAt >= ?'); params.push(new Date(startDate)); }
        if (endDate) { where.push('ct.createdAt <= ?'); params.push(new Date(endDate)); }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const offset = (Number(page) - 1) * Number(limit);

        const [rows] = await db.query(
            `SELECT ct.txnID, ct.uid, u.username, u.emailID, ct.type, ct.coins, ct.refType, ct.refID, ct.createdAt
             FROM coin_transactions ct
             LEFT JOIN users u ON u.uid = ct.uid
             ${whereClause}
             ORDER BY ct.${sortCol} ${sortDirection}
             LIMIT ? OFFSET ?`,
            [...params, Number(limit), Number(offset)]
        );

        const [[{ total } = { total: 0 }]] = await db.query(
            `SELECT COUNT(*) AS total FROM coin_transactions ct ${whereClause}`,
            params
        );

        // Aggregates
        const [[agg]] = await db.query(
            `SELECT 
                SUM(CASE WHEN type='earn' THEN coins ELSE 0 END) AS totalEarned,
                SUM(CASE WHEN type='pending' THEN coins ELSE 0 END) AS totalPending,
                SUM(CASE WHEN type='redeem' THEN coins ELSE 0 END) AS totalRedeemed,
                SUM(CASE WHEN type='expire' THEN coins ELSE 0 END) AS totalExpired,
                SUM(CASE WHEN type='reversal' THEN coins ELSE 0 END) AS totalReversed
             FROM coin_transactions ct ${whereClause}`,
            params
        );

        return res.status(200).json({
            success: true,
            page: Number(page),
            limit: Number(limit),
            total,
            aggregates: agg || {},
            rows
        });
    } catch (e) {
        console.error('Admin coins list error:', e);
        return res.status(500).json({ success: false, message: e?.message || 'Internal error' });
    }
});

module.exports = router;


