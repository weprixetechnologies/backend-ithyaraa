const db = require('../utils/dbconnect');
const settlementService = require('../services/settlementService');

/**
 * Nightly Settlement Cron
 * Finds items where the return window (7 days) has passed without a return.
 * Records 'return_window_cleared' (Credit) and updates item status.
 */

async function runSettlementCron() {
    console.log(`[Settlement Cron] Starting at ${new Date().toISOString()}`);
    
    try {
        // Task 1: Find normal delivered items that passed the return window
        // Task 2: Find replacement items that passed their return window
        
        const [eligibleItems] = await db.query(`
            SELECT oi.orderItemID, oi.orderID, oi.brandID, od.isReplacement, sod.relatedOrderItemId
            FROM order_items oi
            JOIN orderDetail od ON oi.orderID = od.orderID
            LEFT JOIN settlement_order_details sod ON oi.orderItemID = sod.orderItemID AND sod.event = 'replacement_item'
            WHERE oi.itemStatus = 'delivered'
              AND (oi.returnStatus IS NULL OR oi.returnStatus IN ('none', 'returnRejected'))
              AND oi.coinLockUntil IS NOT NULL
              AND oi.coinLockUntil <= NOW()
              AND oi.settlementStatus = 'unsettled'
              AND oi.brandID IS NOT NULL
              AND oi.brandID != 'inhouse'
        `);

        console.log(`[Settlement Cron] Found ${eligibleItems.length} items eligible for window clearing.`);

        for (const item of eligibleItems) {
            try {
                if (item.isReplacement && item.relatedOrderItemId) {
                    // --- REPLACEMENT ITEM CLEARS WINDOW ---
                    // Current logic per user: Credit BOTH 200 and 201 fully once 201 clears.
                    
                    // 1. Credit the replacement item (201)
                    const recordRepl = await settlementService.recordEvent({
                        orderItemID: item.orderItemID,
                        event: 'return_window_cleared',
                        effect: 'credit',
                        notes: `Replacement item window cleared - crediting fully.`
                    });

                    if (recordRepl.success) {
                        await db.query(`UPDATE order_items SET settlementStatus = 'included' WHERE orderItemID = ?`, [item.orderItemID]);
                        console.log(`[Settlement Cron] Replacement item ${item.orderItemID} credited.`);

                        // 2. Also credit the original item (200) if not already credited
                        const [origStatus] = await db.query(`
                            SELECT settlementStatus FROM order_items WHERE orderItemID = ?
                        `, [item.relatedOrderItemId]);

                        if (origStatus.length > 0 && origStatus[0].settlementStatus !== 'included') {
                            const recordOrig = await settlementService.recordEvent({
                                orderItemID: item.relatedOrderItemId,
                                event: 'return_window_cleared',
                                effect: 'credit',
                                notes: `Original item credited because replacement ${item.orderItemID} window cleared.`
                            });
                            if (recordOrig.success) {
                                await db.query(`UPDATE order_items SET settlementStatus = 'included' WHERE orderItemID = ?`, [item.relatedOrderItemId]);
                                console.log(`[Settlement Cron] Original item ${item.relatedOrderItemId} also credited.`);
                            }
                        }
                    } else {
                        await settlementService.logFailure(item.orderItemID, 'return_window_cleared', { isReplacement: true }, recordRepl.error);
                    }

                } else {
                    // --- NORMAL ITEM: Simple credit ---
                    const record = await settlementService.recordEvent({
                        orderItemID: item.orderItemID,
                        event: 'return_window_cleared',
                        effect: 'credit',
                        notes: 'Return window passed successfully'
                    });

                    if (record.success) {
                        await db.query(`UPDATE order_items SET settlementStatus = 'included' WHERE orderItemID = ?`, [item.orderItemID]);
                        console.log(`[Settlement Cron] Normal item ${item.orderItemID} credited.`);
                    } else {
                        await settlementService.logFailure(item.orderItemID, 'return_window_cleared', {}, record.error);
                    }
                }
            } catch (itemErr) {
                console.error(`[Settlement Cron] Failed to process item ${item.orderItemID}:`, itemErr);
                await settlementService.logFailure(item.orderItemID, 'return_window_cleared', {}, itemErr);
            }
        }

        console.log(`[Settlement Cron] Finished at ${new Date().toISOString()}`);
    } catch (error) {
        console.error(`[Settlement Cron] Critical error:`, error);
    } finally {
        process.exit(0);
    }
}

runSettlementCron();
