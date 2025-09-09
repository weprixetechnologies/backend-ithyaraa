const orderModel = require('./../model/orderModel')
const getCart = require('./../services/cartService')
const couponsModel = require('./../model/couponsModel')
const db = require('./../utils/dbconnect');
const usersModel = require('./../model/usersModel');
const affiliateModel = require('./../model/affiliateModel');
const { randomUUID } = require('crypto');

async function placeOrder(uid, addressID, paymentMode = 'cod', couponCode = null) {
    // Step 1: Process cart (offers, totals, summary)
    const cartData = await getCart.getCart(uid);

    if (!cartData.items || cartData.items.length === 0) {
        throw new Error('Cart is empty');
    }

    // Step 2: Handle coupon validation and discount calculation
    let couponDiscount = 0;
    let finalSummary = { ...cartData.summary };

    if (couponCode) {
        try {
            const couponResult = await validateAndApplyCoupon(couponCode, cartData);
            if (couponResult.success) {
                couponDiscount = couponResult.discount;
                finalSummary.totalDiscount = (finalSummary.totalDiscount || 0) + couponDiscount;
                finalSummary.total = finalSummary.subtotal - finalSummary.totalDiscount;
            } else {
                throw new Error(couponResult.message);
            }
        } catch (error) {
            throw new Error(`Coupon validation failed: ${error.message}`);
        }
    }

    // Step 3: Store order using processed cart data with new fields
    const newOrder = await orderModel.createOrder({
        uid,
        addressID,
        paymentMode,
        couponCode,
        couponDiscount,
        items: cartData.items,
        summary: finalSummary
    });

    // Step 4: Increment coupon usage if coupon was applied
    if (couponCode && couponDiscount > 0) {
        try {
            await couponsModel.incrementCouponUsage(couponCode);
        } catch (error) {
            console.error('Failed to increment coupon usage:', error);
            // Don't throw error - order is already created successfully
        }
    }

    // Step 5: Process referBy commissions for cart items (OPTIMIZED)
    try {
        // Group items by referBy and calculate commissions in one pass
        const referByGroups = {};
        const referByUids = new Set();

        // Single pass: group items and collect UIDs
        for (const item of cartData.items) {
            if (item.referBy) {
                if (!referByGroups[item.referBy]) {
                    referByGroups[item.referBy] = [];
                    referByUids.add(item.referBy);
                }
                referByGroups[item.referBy].push(item);
            }
        }

        if (referByUids.size > 0) {
            // Batch fetch all referrer users in one query
            const referrerUsers = await batchFetchUsers(Array.from(referByUids));
            const referrerMap = new Map(referrerUsers.map(user => [user.uid, user]));

            // Prepare batch operations
            const pendingPaymentUpdates = [];
            const affiliateTransactions = [];

            // Process all referBy groups
            for (const [referByUid, items] of Object.entries(referByGroups)) {
                const referrerUser = referrerMap.get(referByUid);

                if (referrerUser) {
                    // Calculate total commission for this referrer (10% of item amounts)
                    let totalCommission = 0;

                    for (const item of items) {
                        const itemAmount = (item.salePrice || item.regularPrice || 0) * item.quantity;
                        totalCommission += itemAmount * 0.10; // Calculate without parseFloat/toFixed for speed
                    }

                    if (totalCommission > 0) {
                        // Round to 2 decimal places once
                        totalCommission = Math.round(totalCommission * 100) / 100;

                        // Prepare batch operations
                        pendingPaymentUpdates.push({
                            uid: referrerUser.uid,
                            amount: totalCommission
                        });

                        affiliateTransactions.push({
                            txnID: randomUUID(),
                            uid: referrerUser.uid,
                            status: 'pending',
                            amount: totalCommission,
                            type: 'incoming'
                        });
                    }
                }
            }

            // Execute batch operations in parallel
            if (pendingPaymentUpdates.length > 0) {
                await Promise.all([
                    batchIncrementPendingPayment(pendingPaymentUpdates),
                    batchCreateAffiliateTransactions(affiliateTransactions)
                ]);
            }
        }
    } catch (referByError) {
        console.error('ReferBy processing error:', referByError);
        // Non-blocking
    }

    // Step 6: Affiliate credit if coupon has assignedUser (email) - OPTIMIZED
    try {
        if (couponCode && couponDiscount >= 0) {
            // Get coupon and user in parallel
            const [couponResult, assignedUser] = await Promise.all([
                db.query('SELECT assignedUser FROM coupons WHERE couponCode = ? LIMIT 1', [couponCode]),
                // Pre-fetch user if we know the email (optimization for future)
                Promise.resolve(null) // Placeholder for parallel structure
            ]);

            const assignedUserEmail = couponResult[0] && couponResult[0][0] ? couponResult[0][0].assignedUser : null;

            if (assignedUserEmail) {
                // Find user by emailID from assignedUser
                const assignedUser = await usersModel.findUserByEmail(assignedUserEmail);

                if (assignedUser && assignedUser.uid) {
                    // 20% of order total (after discount) - optimized calculation
                    const orderTotal = Number(finalSummary.total) || 0;
                    const commission = Math.round(orderTotal * 0.20 * 100) / 100; // Single calculation

                    if (commission > 0) {
                        // Execute both operations in parallel
                        await Promise.all([
                            usersModel.incrementPendingPayment(assignedUser.uid, commission),
                            affiliateModel.createAffiliateTransaction({
                                txnID: randomUUID(),
                                uid: assignedUser.uid,
                                status: 'pending',
                                amount: commission,
                                type: 'incoming'
                            })
                        ]);
                    }
                }
            }
        }
    } catch (affiliateError) {
        console.error('Affiliate credit error:', affiliateError);
        // Non-blocking
    }

    return newOrder;
}


// Coupon validation and discount calculation
async function validateAndApplyCoupon(couponCode, cartData) {
    try {
        // Get coupon details by code
        const db = require('./../utils/dbconnect');
        const [couponRows] = await db.query(
            'SELECT * FROM coupons WHERE couponCode = ? AND (usageLimit IS NULL OR couponUsage < usageLimit)',
            [couponCode]
        );

        if (!couponRows || couponRows.length === 0) {
            return { success: false, message: 'Invalid or expired coupon code' };
        }

        const coupon = couponRows[0];

        // Calculate subtotal for products with NO OFFER only
        let subtotal = 0;
        cartData.items.forEach(item => {
            // Only apply coupon to products that have NO OFFER (no offerID and not combo type)
            if (!item.offerID && item.type !== 'combo') {
                const price = item.salePrice || item.regularPrice || 0;
                subtotal += price * item.quantity;
            }
        });

        // Check if there are any eligible products for coupon
        if (subtotal === 0) {
            return {
                success: false,
                message: 'No eligible products found for this coupon. Coupons can only be applied to products without offers.'
            };
        }

        // Calculate discount based on coupon type
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            discount = subtotal * (Number(coupon.discountValue) / 100);
        } else if (coupon.discountType === 'flat') {
            discount = Number(coupon.discountValue);
        }

        // Ensure discount is a valid number
        if (isNaN(discount)) {
            discount = 0;
        }

        // Ensure discount does not exceed subtotal
        if (discount > subtotal) {
            discount = subtotal;
        }

        // Check if there's a minimum order value requirement (if such field exists)
        if (coupon.minimumOrderValue && subtotal < coupon.minimumOrderValue) {
            return {
                success: false,
                message: `Minimum order value of ₹${coupon.minimumOrderValue} required for this coupon`
            };
        }

        return {
            success: true,
            discount: parseFloat(Number(discount).toFixed(2)),
            coupon: {
                couponID: coupon.couponID,
                couponCode: coupon.couponCode,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue
            }
        };

    } catch (error) {
        console.error('Coupon validation error:', error);
        return { success: false, message: 'Error validating coupon' };
    }
}

module.exports = { placeOrder, validateAndApplyCoupon }

async function getOrderItemsByUid(uid) {
    return await orderModel.getOrderItemsByUid(uid);
}

module.exports.getOrderItemsByUid = getOrderItemsByUid;

async function updateOrder(orderID, updateData) {
    return await orderModel.updateOrderByID(orderID, updateData);
}

module.exports.updateOrder = updateOrder;

// OPTIMIZATION HELPER FUNCTIONS

// Batch fetch users by UIDs
async function batchFetchUsers(uids) {
    if (uids.length === 0) return [];

    const placeholders = uids.map(() => '?').join(',');
    const [rows] = await db.query(
        `SELECT uid, username, emailID, phonenumber, balance, pendingPayment FROM users WHERE uid IN (${placeholders})`,
        uids
    );
    return rows;
}

// Batch increment pending payment for multiple users
async function batchIncrementPendingPayment(updates) {
    if (updates.length === 0) return;

    // Use CASE statement for batch update
    const uidList = updates.map(u => u.uid);
    const caseStatements = updates.map(u => `WHEN '${u.uid}' THEN COALESCE(pendingPayment, 0) + ${u.amount}`).join(' ');

    await db.query(
        `UPDATE users SET pendingPayment = CASE uid ${caseStatements} END WHERE uid IN (${uidList.map(() => '?').join(',')})`,
        uidList
    );
}

// Batch create affiliate transactions
async function batchCreateAffiliateTransactions(transactions) {
    if (transactions.length === 0) return;

    // Ensure every transaction has a txnID
    const sanitized = transactions.map(t => ({
        txnID: t.txnID || randomUUID(),
        uid: t.uid,
        status: t.status || 'pending',
        amount: t.amount,
        type: t.type || 'incoming'
    }));

    // Build parameterized multi-row insert
    const placeholders = sanitized.map(() => '(?, ?, ?, ?, ?)').join(',');
    const params = sanitized.flatMap(t => [t.txnID, t.uid, t.status, t.amount, t.type]);

    // Use the correct table name as per affiliateModel
    await db.query(
        `INSERT INTO affiliateTransactions (txnID, uid, status, amount, type) VALUES ${placeholders}`,
        params
    );
}