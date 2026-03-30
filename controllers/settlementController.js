const db = require('../utils/dbconnect');
const settlementService = require('../services/settlementService');

/**
 * ADMIN: Get all settlement periods
 */
const getAllSettlements = async (req, res) => {
    try {
        const { brandID, month, status, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        
        let query = `
            SELECT bsp.*, u.username as brandName, u.emailID as brandEmail
            FROM brand_settlement_periods bsp
            LEFT JOIN users u ON bsp.brandID = u.uid
            WHERE 1=1
        `;
        const params = [];

        if (brandID) {
            query += ` AND bsp.brandID = ?`;
            params.push(brandID);
        }
        if (month) {
            query += ` AND bsp.settlementMonth = ?`;
            params.push(month);
        }
        if (status) {
            query += ` AND bsp.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY bsp.settlementMonth DESC, bsp.createdAt DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), offset);

        const [rows] = await db.query(query, params);
        
        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM brand_settlement_periods WHERE 1=1`;
        const countParams = [];
        if (brandID) { countQuery += ` AND brandID = ?`; countParams.push(brandID); }
        if (month) { countQuery += ` AND settlementMonth = ?`; countParams.push(month); }
        if (status) { countQuery += ` AND status = ?`; countParams.push(status); }

        const [[{ total }]] = await db.query(countQuery, countParams);

        return res.json({ success: true, data: rows, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
        console.error('Error fetching settlements:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ADMIN & BRAND: Get settlement detail (Statement)
 */
const getSettlementDetail = async (req, res) => {
    try {
        const { brandID, month } = req.params;
        const isAdmin = req.user.role === 'admin';
        
        // If brand, they can only see their own
        if (!isAdmin && req.user.uid !== brandID) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // 1. Get period summary
        const [periods] = await db.query(`
            SELECT bsp.*, u.username as brandName, u.emailID as brandEmail
            FROM brand_settlement_periods bsp
            LEFT JOIN users u ON bsp.brandID = u.uid
            WHERE bsp.brandID = ? AND bsp.settlementMonth = ?
        `, [brandID, month]);

        if (periods.length === 0) {
            return res.status(404).json({ success: false, message: 'Settlement period not found' });
        }

        // 2. Get ledger items (statement)
        const [ledger] = await db.query(`
            SELECT * FROM settlement_order_details
            WHERE brandID = ? AND settlementMonth = ?
            ORDER BY createdAt DESC
        `, [brandID, month]);

        // 3. Get payments audit log
        const [payments] = await db.query(`
            SELECT * FROM brand_settlement_payments
            WHERE brandID = ? AND settlementPeriodID = ?
            ORDER BY paymentDate DESC
        `, [brandID, periods[0].id]);

        return res.json({
            success: true,
            period: periods[0],
            statement: ledger,
            payments: payments
        });
    } catch (error) {
        console.error('Error fetching settlement detail:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ADMIN: Record a payment
 */
const recordPayment = async (req, res) => {
    try {
        const { id } = req.params; // brand_settlement_periods.id
        const { amount, paymentMode, utrReference, paymentDate, remarks } = req.body;
        const recordedBy = req.user.username || req.user.uid;

        if (!amount || !paymentMode || !paymentDate) {
            return res.status(400).json({ success: false, message: 'Amount, paymentMode, and paymentDate are required' });
        }

        // 1. Get period info
        const [periods] = await db.query('SELECT * FROM brand_settlement_periods WHERE id = ?', [id]);
        if (periods.length === 0) return res.status(404).json({ success: false, message: 'Period not found' });
        const period = periods[0];

        // 2. Record payment in audit log
        await db.query(`
            INSERT INTO brand_settlement_payments (
                settlementPeriodID, brandID, amount, paymentMode, utrReference, paymentDate, remarks, recordedBy
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, period.brandID, amount, paymentMode, utrReference, paymentDate, remarks, recordedBy]);

        // 3. Update period totals
        await db.query(`
            UPDATE brand_settlement_periods
            SET amountPaid = amountPaid + ?,
                balanceDue = balanceDue - ?,
                status = CASE 
                    WHEN (amountPaid + ?) >= netPayable THEN 'paid'
                    WHEN (amountPaid + ?) > 0 THEN 'partially_paid'
                    ELSE status
                END,
                paidAt = NOW(),
                paidBy = ?
            WHERE id = ?
        `, [amount, amount, amount, amount, recordedBy, id]);

        return res.json({ success: true, message: 'Payment recorded successfully' });
    } catch (error) {
        console.error('Error recording payment:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * BRAND: Get my settlements
 */
const getMySettlements = async (req, res) => {
    try {
        const brandID = req.user.uid;
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        const [rows] = await db.query(`
            SELECT * FROM brand_settlement_periods
            WHERE brandID = ?
            ORDER BY settlementMonth DESC, createdAt DESC
            LIMIT ? OFFSET ?
        `, [brandID, Number(limit), offset]);

        const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM brand_settlement_periods WHERE brandID = ?', [brandID]);

        return res.json({ success: true, data: rows, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
        console.error('Error fetching my settlements:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ADMIN: Manually clear the return window for a ledger entry
 */
const manualClearWindow = async (req, res) => {
    try {
        const { id } = req.params; // settlement_order_details.id
        const recordedBy = req.user.username || req.user.uid;

        // 1. Get ledger entry
        const [ledgerEntries] = await db.query('SELECT * FROM settlement_order_details WHERE id = ?', [id]);
        if (ledgerEntries.length === 0) return res.status(404).json({ success: false, message: 'Ledger entry not found' });
        
        const entry = ledgerEntries[0];

        // 2. Validation
        if (entry.effect !== 'hold' || (entry.event !== 'order_delivered' && entry.event !== 'order_placed')) {
            return res.status(400).json({ success: false, message: 'Only hold events (placed/delivered) can be manually cleared' });
        }

        // 3. Check if already cleared
        const [existingCredits] = await db.query(`
            SELECT id FROM settlement_order_details 
            WHERE orderItemID = ? AND event = 'return_window_cleared'
        `, [entry.orderItemID]);

        if (existingCredits.length > 0) {
            return res.status(400).json({ success: false, message: 'Return window already cleared for this item' });
        }

        // 4. Record the credit event (Current item)
        const result = await settlementService.recordEvent({
            orderItemID: entry.orderItemID,
            event: 'return_window_cleared',
            effect: 'credit',
            notes: 'Manual override by Admin',
            createdBy: recordedBy
        });

        if (!result.success) throw new Error(result.error);

        // 5. Update current order_item status
        await db.query(`UPDATE order_items SET settlementStatus = 'included' WHERE orderItemID = ?`, [entry.orderItemID]);

        // 6. Handle Replacements (Bidirectional Clearing - Robust)
        
        let originalItemID = null;
        let replacementItemID = null;

        // Try to find if THIS item is a replacement (Find the original)
        const [asRepl] = await db.query(`
            SELECT relatedOrderItemId FROM settlement_order_details 
            WHERE orderItemID = ? AND relatedOrderItemId IS NOT NULL 
            LIMIT 1
        `, [entry.orderItemID]);
        if (asRepl.length > 0) originalItemID = asRepl[0].relatedOrderItemId;

        // Try to find if THIS item was replaced (Find the replacement)
        const [asOrig] = await db.query(`
            SELECT orderItemID FROM settlement_order_details 
            WHERE relatedOrderItemId = ? AND event = 'replacement_item' 
            LIMIT 1
        `, [entry.orderItemID]);
        if (asOrig.length > 0) replacementItemID = asOrig[0].orderItemID;

        // --- Credit the Other Half of the Pair ---
        const peerItemID = originalItemID || replacementItemID;
        if (peerItemID) {
            const [peerStatus] = await db.query(`
                SELECT settlementStatus FROM order_items WHERE orderItemID = ?
            `, [peerItemID]);

            if (peerStatus.length > 0 && peerStatus[0].settlementStatus !== 'included') {
                const recordPeer = await settlementService.recordEvent({
                    orderItemID: peerItemID,
                    event: 'return_window_cleared',
                    effect: 'credit',
                    notes: `Automatic peer-clearing (Linked to manual override of ${entry.orderItemID})`,
                    createdBy: recordedBy
                });
                if (recordPeer.success) {
                    await db.query(`UPDATE order_items SET settlementStatus = 'included' WHERE orderItemID = ?`, [peerItemID]);
                }
            }
        }

        return res.json({ success: true, message: 'Return window cleared manually (Replacement pair processed if applicable)' });
    } catch (error) {
        console.error('Error manual clearing window:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ADMIN: Trigger the settlement check manually (instead of waiting for Cron)
 */
const runCheckManually = async (req, res) => {
    try {
        console.log(`[Manual Action] Settlement check triggered by ${req.user.username}`);
        
        // Find items that are delivered, passed return window, and unsettled
        const [eligibleItems] = await db.query(`
            SELECT oi.orderItemID, oi.orderID, oi.brandID, od.isReplacement, sod.relatedOrderItemId
            FROM order_items oi
            JOIN orderDetail od ON oi.orderID = od.orderID
            LEFT JOIN settlement_order_details sod ON oi.orderItemID = sod.orderItemID AND sod.event = 'replacement_item'
            WHERE oi.itemStatus = 'delivered'
              AND (oi.returnStatus IS NULL OR oi.returnStatus = 'none')
              AND (oi.coinLockUntil IS NOT NULL AND oi.coinLockUntil <= NOW())
              AND oi.settlementStatus = 'unsettled'
              AND oi.brandID IS NOT NULL
        `);

        let processed = 0;
        for (const item of eligibleItems) {
            if (item.isReplacement && item.relatedOrderItemId) {
                // Replacement Credit Flow
                const recordRepl = await settlementService.recordEvent({
                    orderItemID: item.orderItemID,
                    event: 'return_window_cleared',
                    effect: 'credit',
                    notes: 'Manual check - replacement unit'
                });
                if (recordRepl.success) {
                    await db.query(`UPDATE order_items SET settlementStatus = 'included' WHERE orderItemID = ?`, [item.orderItemID]);
                    // Credit original too
                    const [origStatus] = await db.query(`SELECT settlementStatus FROM order_items WHERE orderItemID = ?`, [item.relatedOrderItemId]);
                    if (origStatus.length > 0 && origStatus[0].settlementStatus !== 'included') {
                        const recordOrig = await settlementService.recordEvent({
                            orderItemID: item.relatedOrderItemId,
                            event: 'return_window_cleared',
                            effect: 'credit',
                            notes: `Manual check - original unit for replacement ${item.orderItemID}`
                        });
                        if (recordOrig.success) {
                            await db.query(`UPDATE order_items SET settlementStatus = 'included' WHERE orderItemID = ?`, [item.relatedOrderItemId]);
                        }
                    }
                    processed++;
                }
            } else {
                // Normal Credit Flow
                const record = await settlementService.recordEvent({
                    orderItemID: item.orderItemID,
                    event: 'return_window_cleared',
                    effect: 'credit',
                    notes: 'Manual check - return window expired'
                });
                if (record.success) {
                    await db.query(`UPDATE order_items SET settlementStatus = 'included' WHERE orderItemID = ?`, [item.orderItemID]);
                    processed++;
                }
            }
        }

        return res.json({ success: true, message: `Check complete. Processed ${processed} items.` });
    } catch (error) {
        console.error('Error running check manually:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllSettlements,
    getSettlementDetail,
    recordPayment,
    getMySettlements,
    manualClearWindow,
    runCheckManually
};
