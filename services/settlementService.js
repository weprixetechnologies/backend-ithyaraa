const db = require('../utils/dbconnect');

/**
 * Brand Settlement Service
 * Handles the append-only ledger (settlement_order_details) and period totals.
 */

const recordEvent = async ({
    orderItemID,
    event,
    effect, // 'hold', 'credit', 'debit', 'neutral', 'ERROR'
    notes = null,
    createdBy = 'system',
    refundQueryID = null,
    manualEarning = null,
    relatedOrderItemId = null,
    connection = null // Allow passing a connection for external transactions
}) => {
    const conn = connection || await db.getConnection();
    let isInternalTransaction = !connection;

    try {
        if (isInternalTransaction) await conn.beginTransaction();

        // 1. Fetch item details
        const [items] = await conn.query(`
            SELECT oi.*, od.orderID, od.createdAt as orderDate, u.commissionPercentage as brandCommission
            FROM order_items oi
            JOIN orderDetail od ON oi.orderID = od.orderID
            LEFT JOIN users u ON oi.brandID = u.uid
            WHERE oi.orderItemID = ?
        `, [orderItemID]);

        if (items.length === 0) {
            throw new Error(`Item not found for settlement: ${orderItemID}`);
        }

        const item = items[0];
        const { brandID, orderID, productID, productName, variationName, quantity, lineTotalAfter, brandCommission } = item;

        // Skip inhouse or null brands
        if (!brandID || brandID === 'inhouse') {
            if (isInternalTransaction) await conn.commit();
            return { success: true, message: 'Skipped inhouse item' };
        }

        // 2. Calculate brand earning & validate commission
        let finalEffect = effect;
        let finalEvent = event;
        let finalNotes = notes;
        const commissionPct = Number(brandCommission);
        
        if (!Number.isFinite(commissionPct)) {
            console.warn(`[Settlement] Invalid commission for brand ${brandID}, item ${orderItemID}`);
            finalEffect = 'ERROR';
            finalNotes = (finalNotes ? finalNotes + ' | ' : '') + 'Commission not configured for brand';
        }

        const commissionAmount = Math.round((lineTotalAfter * (commissionPct || 0) / 100) * 100) / 100;
        const brandEarning = manualEarning !== null ? manualEarning : (lineTotalAfter - commissionAmount);
        let effectAmount = (finalEffect === 'neutral' || finalEffect === 'ERROR') ? 0 : brandEarning;

        // 3. Determine settlement month (YYYY-MM)
        const now = new Date();
        let settlementMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        if (event === 'order_placed') {
            const orderDate = new Date(item.orderDate);
            settlementMonth = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        }

        // 4. Logic Updates
        
        // Part 2: Refund Logic (event: returned)
        if (event === 'returned') {
            const [credits] = await conn.query(`
                SELECT id FROM settlement_order_details 
                WHERE orderItemID = ? AND event = 'return_window_cleared' AND effect = 'credit'
            `, [orderItemID]);

            if (credits.length > 0) {
                // Was previously CREDITED: Record Reversal (DEBIT) then NEUTRAL
                await insertLedgerEntry(conn, {
                    brandID, orderItemID, orderID, productID, productName, variationName, 
                    quantity, lineTotalAfter, commissionPct, commissionAmount, brandEarning,
                    settlementMonth, event: 'refund_reversal', effect: 'debit', effectAmount: brandEarning, 
                    isReplacement: item.isReplacement || 0, wasCarriedForward: item.wasCarriedForward || 0,
                    refundQueryID, notes: 'Reversal of previous credit due to refund', createdBy
                });
            }
            
            // Record the returned event as NEUTRAL
            finalEffect = 'neutral';
            effectAmount = 0;
            finalNotes = (finalNotes ? finalNotes + ' | ' : '') + 'Item refunded — earnings neutralized';
        }

        // Handle "Debit without Credit" protection for other debit events (not 'returned' which we handled above)
        if (finalEffect === 'debit' && event !== 'refund_reversal') {
            const [credits] = await conn.query(`
                SELECT id FROM settlement_order_details 
                WHERE orderItemID = ? AND event IN ('return_window_cleared', 'replacement_complete') AND effect = 'credit'
            `, [orderItemID]);

            if (credits.length === 0) {
                finalEffect = 'neutral';
                effectAmount = 0;
                finalNotes = (finalNotes ? finalNotes + ' | ' : '') + 'Converted to neutral (never credited)';
            }
        }

        if (event === 'order_placed' && finalEffect === 'hold' && effectAmount === 0) {
            effectAmount = 0;
        }

        if (event === 'order_delivered' && finalEffect === 'hold') {
             effectAmount = brandEarning;
        }

        // 5. Ensure period summary exists
        await ensurePeriodExists(conn, brandID, settlementMonth, (commissionPct || 0));

        // 6. Record in settlement_order_details
        await insertLedgerEntry(conn, {
            brandID, orderItemID, orderID, productID, productName, variationName, 
            quantity, lineTotalAfter, commissionPct, commissionAmount, brandEarning,
            settlementMonth, event: finalEvent, effect: finalEffect, effectAmount, 
            isReplacement: item.isReplacement || 0, wasCarriedForward: item.wasCarriedForward || 0,
            refundQueryID, notes: finalNotes, createdBy, relatedOrderItemId
        });

        // 7. Recalculate Period Totals
        await recalculatePeriodTotals(brandID, settlementMonth, conn);

        if (isInternalTransaction) await conn.commit();
        return { success: true };
    } catch (error) {
        if (isInternalTransaction) {
            try { await conn.rollback(); } catch (rbErr) { console.error('Rollback failed:', rbErr); }
        }
        console.error('Error recording settlement event:', { orderItemID, event, error: error.message });
        return { success: false, error: error.message };
    } finally {
        if (isInternalTransaction) conn.release();
    }
};

const insertLedgerEntry = async (conn, data) => {
    await conn.query(`
        INSERT INTO settlement_order_details (
            brandID, orderItemID, orderID, productID, productName, variationName, 
            quantity, lineTotalAfter, commissionPct, commissionAmount, brandEarning,
            settlementMonth, event, effect, effectAmount, isReplacement, wasCarriedForward,
            refundQueryID, notes, createdBy, relatedOrderItemId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        data.brandID, data.orderItemID, data.orderID, data.productID, data.productName, data.variationName,
        data.quantity, data.lineTotalAfter, data.commissionPct, data.commissionAmount, data.brandEarning,
        data.settlementMonth, data.event, data.effect, data.effectAmount, data.isReplacement, data.wasCarriedForward,
        data.refundQueryID, data.notes, data.createdBy, data.relatedOrderItemId
    ]);
};

const ensurePeriodExists = async (conn, brandID, settlementMonth, commissionPct) => {
    const now = new Date();
    // month is in YYYY-MM format
    const [year, month] = settlementMonth.split('-').map(Number);
    const periodStart = `${settlementMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${settlementMonth}-${lastDay}`;

    await conn.query(`
        INSERT IGNORE INTO brand_settlement_periods (brandID, settlementMonth, periodStart, periodEnd, commissionPct)
        VALUES (?, ?, ?, ?, ?)
    `, [brandID, settlementMonth, periodStart, periodEnd, commissionPct]);
};

const recalculatePeriodTotals = async (brandID, settlementMonth, connection = null) => {
    const conn = connection || db;
    try {
        await conn.query(`
            UPDATE brand_settlement_periods bsp
            SET
              totalCredits = (
                SELECT COALESCE(SUM(effectAmount), 0)
                FROM settlement_order_details
                WHERE brandID = bsp.brandID 
                  AND settlementMonth = bsp.settlementMonth
                  AND effect = 'credit'
              ),
              totalDebits = (
                SELECT COALESCE(SUM(effectAmount), 0)
                FROM settlement_order_details
                WHERE brandID = bsp.brandID 
                  AND settlementMonth = bsp.settlementMonth
                  AND effect = 'debit'
              ),
              totalOnHold = (
                SELECT COALESCE(SUM(effectAmount), 0)
                FROM settlement_order_details
                WHERE brandID = bsp.brandID 
                  AND settlementMonth = bsp.settlementMonth
                  AND effect = 'hold'
              ),
              creditCount = (
                SELECT COUNT(*) FROM settlement_order_details
                WHERE brandID = bsp.brandID 
                  AND settlementMonth = bsp.settlementMonth
                  AND effect = 'credit'
              ),
              debitCount = (
                SELECT COUNT(*) FROM settlement_order_details
                WHERE brandID = bsp.brandID 
                  AND settlementMonth = bsp.settlementMonth
                  AND effect = 'debit'
              ),
              holdCount = (
                SELECT COUNT(*) FROM settlement_order_details
                WHERE brandID = bsp.brandID 
                  AND settlementMonth = bsp.settlementMonth
                  AND effect = 'hold'
              ),
              netPayable = totalCredits - totalDebits,
              balanceDue = (totalCredits - totalDebits) - amountPaid,
              updatedAt = NOW()
            WHERE brandID = ? AND settlementMonth = ?;
        `, [brandID, settlementMonth]);

        return { success: true };
    } catch (error) {
        console.error('Error recalculating period totals:', error);
        return { success: false, error: error.message };
    }
};

const logFailure = async (orderItemID, event, payload, error) => {
    try {
        await db.query(`
            INSERT INTO settlement_failed_events (orderItemId, event, payload, error)
            VALUES (?, ?, ?, ?)
        `, [orderItemID, event, JSON.stringify(payload), error.message || String(error)]);
    } catch (logErr) {
        console.error('[Settlement] CRITICAL: Failed to log failure to retry table:', logErr);
    }
};

/**
 * Phase 1: Admin marks replacement_complete
 * Credits the original item unconditionally.
 */
const manualReplacementCredit = async (originalOrderItemId, recordedBy = 'admin') => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Find existing record (HOLD or replacement_original)
        const [entries] = await conn.query(`
            SELECT * FROM settlement_order_details 
            WHERE orderItemID = ? AND event IN ('order_delivered', 'replacement_original')
            ORDER BY createdAt DESC LIMIT 1
        `, [originalOrderItemId]);

        if (entries.length === 0) {
             throw new Error('Eligible ledger entry not found for replacement credit');
        }

        const entry = entries[0];

        // 2. Update to replacement_complete and set effect: CREDIT
        await conn.query(`
            UPDATE settlement_order_details
            SET event = 'replacement_complete', effect = 'credit', effectAmount = brandEarning, createdBy = ?
            WHERE id = ?
        `, [recordedBy, entry.id]);

        // 3. Recalculate
        await recalculatePeriodTotals(entry.brandID, entry.settlementMonth, conn);

        await conn.commit();
        return { success: true };
    } catch (error) {
        await conn.rollback();
        console.error('Error in manualReplacementCredit:', error);
        return { success: false, error: error.message };
    } finally {
        conn.release();
    }
};

module.exports = {
    recordEvent,
    recalculatePeriodTotals,
    logFailure,
    manualReplacementCredit
};
