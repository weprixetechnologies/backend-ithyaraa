const db = require('./../utils/dbconnect')
const { randomUUID } = require('crypto');

const RETURN_WINDOW_DAYS = parseInt(process.env.RETURN_WINDOW_DAYS || '7', 10) || 7;


async function createOrder(orderData) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insert into orderDetail
        const generatedTxnID = orderData.txnID || randomUUID();
        const orderReferBy = orderData.items && orderData.items.length > 0 ? orderData.items[0].referBy : null;
        // Determine payment status based on payment mode
        const pm = (orderData.paymentMode || 'cod').toUpperCase();
        const paymentStatus = (pm === 'PREPAID') ? 'pending' : 'successful'; // FULL_COIN and COD = successful

        const [detailResult] = await connection.query(
            `INSERT INTO orderDetail (
                uid, subtotal, total, totalDiscount, modified, txnID, createdAt,
                addressID,
                shippingName, shippingPhone, shippingEmail,
                shippingLine1, shippingLine2, shippingCity, shippingState, shippingPincode, shippingLandmark,
                paymentMode, paymentStatus, trackingID, deliveryCompany, couponCode, couponDiscount, shippingFee, referBy,
                isWalletUsed, paidWallet, handlingFee, handFeeRate, isBuyNow
            )
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderData.uid,
                orderData.summary.subtotal,
                orderData.summary.total,
                orderData.summary.totalDiscount,
                orderData.summary.anyModifications ? 1 : 0,
                generatedTxnID,
                orderData.addressID,
                orderData.shippingName || null,
                orderData.shippingPhone || null,
                orderData.shippingEmail || null,
                orderData.shippingLine1 || null,
                orderData.shippingLine2 || null,
                orderData.shippingCity || null,
                orderData.shippingState || null,
                orderData.shippingPincode || null,
                orderData.shippingLandmark || null,
                orderData.paymentMode || 'cod',
                paymentStatus,
                orderData.trackingID || null,
                orderData.deliveryCompany || null,
                orderData.couponCode || null,
                orderData.couponDiscount || 0.00,
                orderData.shippingFee || 0.00,
                orderReferBy || null,
                orderData.isWalletUsed || 0,
                orderData.paidWallet || 0.00,
                orderData.handlingFee || 0,
                orderData.handFeeRate || 0.00,
                0 // isBuyNow
            ]
        );
        const orderID = detailResult.insertId;

        // Per-item earned coins (1 coin per ₹100 of order total, distributed by line total)
        const orderTotal = Number(orderData.summary.total) || 0;
        const orderCoins = orderTotal > 0 ? Math.floor(orderTotal / 100) : 0;
        const itemCoinsList = [];
        if (orderCoins > 0 && orderData.items && orderData.items.length > 0) {
            let assigned = 0;
            for (let i = 0; i < orderData.items.length; i++) {
                const it = orderData.items[i];
                const lineAfter = Number(it.lineTotalAfter) || 0;
                const pct = orderTotal > 0 ? lineAfter / orderTotal : 0;
                const coins = i === orderData.items.length - 1
                    ? orderCoins - assigned
                    : Math.floor(orderCoins * pct);
                itemCoinsList.push(Math.max(0, coins));
                assigned += Math.max(0, coins);
            }
        }

        // 2. Insert order_items and deduct stock
        for (let idx = 0; idx < orderData.items.length; idx++) {
            const item = orderData.items[idx];
            const earnedCoins = (itemCoinsList[idx] != null) ? itemCoinsList[idx] : 0;
            await connection.query(
                `INSERT INTO order_items (
                    orderID, uid, productID, quantity,
                    variationID, variationName,
                    overridePrice, salePrice, regularPrice,
                    unitPriceBefore, unitPriceAfter,
                    lineTotalBefore, lineTotalAfter,
                    offerID, offerApplied, offerStatus, appliedOfferID,
                    name, featuredImage, comboID, brandID, brandShippingFee, referBy, custom_inputs, earnedCoins, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    orderID,
                    orderData.uid,
                    item.productID,
                    item.quantity,
                    item.variationID || null,
                    item.variationName || null,
                    item.overridePrice || null,
                    item.salePrice || null,
                    item.regularPrice || 0,
                    item.unitPriceBefore || 0,
                    item.unitPriceAfter || 0,
                    item.lineTotalBefore || 0,
                    item.lineTotalAfter || 0,
                    item.offerID || null,
                    item.offerApplied || false,
                    item.offerStatus || 'none',
                    item.appliedOfferID || null,
                    item.name || null,
                    item.featuredImage ? JSON.stringify(item.featuredImage) : null,
                    item.comboID || null,
                    item.brandID,
                    item.brandShippingFee || 0.00,
                    (item.referBy !== undefined && item.referBy !== null) ? item.referBy : '',
                    item.custom_inputs ? JSON.stringify(item.custom_inputs) : null,
                    earnedCoins
                ]
            );

            // Deduct stock
            console.log(`\n=== STOCK DEDUCTION DEBUG ===`);
            console.log(`Processing item:`, {
                productID: item.productID,
                variationID: item.variationID,
                quantity: item.quantity,
                hasComboItems: !!(item.comboItems && Array.isArray(item.comboItems)),
                comboItemsCount: item.comboItems ? item.comboItems.length : 0
            });
            console.log('ITEM', item);


            if (item.comboID) {
                // Handle combo items - fetch from order_combo_items table
                console.log(`Processing combo items for comboID: ${item.comboID}`);

                const [comboItems] = await connection.query(
                    `SELECT productID, variationID, quantity 
                     FROM order_combo_items 
                     WHERE comboID = ?`,
                    [item.comboID]
                );

                console.log(`Found ${comboItems.length} combo items:`, comboItems);

                for (const combo of comboItems) {
                    const deductQty = item.quantity || 1;
                    console.log(`Deducting ${deductQty} from variation ${combo.variationID} for product ${combo.productID}`);

                    if (combo.variationID) {
                        const [result] = await connection.query(
                            `UPDATE variations
                             SET variationStock = variationStock - ?
                             WHERE variationID = ?`,
                            [deductQty, combo.variationID]
                        );
                        console.log(`Combo stock deduction result:`, result);
                    } else {
                        console.warn(`Combo item ${combo.productID} has no variationID - stock cannot be deducted`);
                    }
                }
            } else if (item.variationID) {
                // Handle products with variations - deduct from variation stock
                console.log(`Deducting ${item.quantity || 1} from variation ${item.variationID}`);

                const [result] = await connection.query(
                    `UPDATE variations
                     SET variationStock = variationStock - ?
                     WHERE variationID = ?`,
                    [item.quantity || 1, item.variationID]
                );
                console.log(`Stock deduction result:`, result);

                // Verify the deduction worked
                const [verifyResult] = await connection.query(
                    `SELECT variationStock FROM variations WHERE variationID = ?`,
                    [item.variationID]
                );
                console.log(`Stock after deduction:`, verifyResult[0]);
            } else {
                // Handle products without variations - check if product has any variations
                // If no variations exist, we can't deduct stock as there's no stock field in products table
                // This is a limitation of the current schema design
                console.warn(`Product ${item.productID} has no variationID - stock cannot be deducted automatically`);
                console.warn(`Manual stock management required for products without variations`);
            }
        }

        // 3. Commit the order transaction
        await connection.commit();

        // 4. Clear only the selected items from the cart (AFTER successful commit)
        // ONLY if it's a COD or FULL_COIN order. For PREPAID, the webhook handles it.
        const pmRaw = (orderData.paymentMode || 'cod').toUpperCase();
        if (pmRaw === 'COD' || pmRaw === 'FULL_COIN') {
            console.log(`[Order Model] Immediate cart cleanup for ${pmRaw} order`);
            const cartModel = require('./cartModel');
            await cartModel.clearCartByUid(orderData.uid);
        } else {
            console.log(`[Order Model] Prepaid order (${pmRaw}) - skipping immediate cart cleanup. Webhook will handle it.`);
        }

        return { orderID, orderData };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

module.exports = { createOrder };

async function getOrderItemsByUid(uid) {
    const connection = await db.getConnection();
    try {
        // Efficient single query using proper indexes on uid and orderID
        const [rows] = await connection.query(
            `SELECT oi.orderItemID, oi.orderID, oi.productID, oi.quantity, oi.variationID, oi.variationName,
                    oi.overridePrice, oi.salePrice, oi.regularPrice,
                    oi.unitPriceBefore, oi.unitPriceAfter,
                    oi.lineTotalBefore, oi.lineTotalAfter,
                    oi.offerID, oi.offerApplied, oi.offerStatus, oi.appliedOfferID,
                    oi.name, oi.featuredImage, oi.comboID, oi.referBy, oi.custom_inputs, oi.createdAt,
                    oi.returnStatus, oi.returnRequestedAt, oi.earnedCoins, oi.coinLockUntil, oi.coinsReversed, oi.brandID, oi.brandShippingFee, oi.itemStatus,
                    p.type AS productType, p.custom_inputs AS productCustomInputs,
                    v.variationName AS fullVariationName, v.variationSlug, v.variationValues,
                    v.variationPrice, v.variationStock, v.variationSalePrice,
                    od.paymentMode, od.paymentStatus, od.orderStatus, od.createdAt as orderCreatedAt,
                    od.total, od.subtotal, od.shippingFee, od.couponDiscount, od.handFeeRate,
                    od.addressID, od.deliveredAt, od.isReplacement, u.username, u.emailID as email, u.phoneNumber as contactNumber
             FROM order_items oi
             INNER JOIN orderDetail od ON oi.orderID = od.orderID
             LEFT JOIN products p ON oi.productID = p.productID
             LEFT JOIN variations v ON oi.variationID = v.variationID
             LEFT JOIN users u ON od.uid = u.uid
             WHERE od.uid = ?
             ORDER BY oi.createdAt DESC, oi.orderID DESC`,
            [uid]
        );

        // Utility: safe JSON parser (deep)
        const safeParse = (value, fallback = null) => {
            try {
                let parsed = value;
                // Keep parsing until it's not a string anymore
                while (typeof parsed === "string") parsed = JSON.parse(parsed);
                return parsed;
            } catch {
                return fallback;
            }
        };

        // Load combo items for each order item (like cart does)
        const cartModel = require('./cartModel');
        for (const item of rows) {
            if (item.comboID) {
                const comboItems = await cartModel.getComboItems(item.comboID);
                item.comboItems = comboItems;
            }

            // Deep parse featuredImage
            item.featuredImage = safeParse(item.featuredImage, []);

            // Deep parse custom_inputs
            item.custom_inputs = safeParse(item.custom_inputs, null);

            // Deep parse product custom inputs (field definitions)
            item.productCustomInputs = safeParse(item.productCustomInputs, []);

            // Parse variation values
            const variationValues = safeParse(item.variationValues, []);

            // Transform variationValues to {label, value} format if needed
            let formattedVariationValues = variationValues;
            if (Array.isArray(variationValues) && variationValues.length > 0) {
                // Check if it's already in {label, value} format
                const first = variationValues[0];
                if (first && !first.label && !first.value) {
                    // Transform from {Color: "Blue"} to {label: "Color", value: "Blue"}
                    formattedVariationValues = variationValues.map(obj => {
                        const entries = Object.entries(obj);
                        if (entries.length > 0) {
                            const [label, value] = entries[0];
                            return { label, value };
                        }
                        return obj;
                    });
                }
            }

            // Debug log
            if (item.variationID) {
                console.log(`[Order Model] Processing variation for order item:`, {
                    variationID: item.variationID,
                    variationName: item.variationName,
                    fullVariationName: item.fullVariationName,
                    variationValues: item.variationValues,
                    parsedVariationValues: variationValues,
                    formattedVariationValues: formattedVariationValues
                });
            }

            // Build full variation object
            if (item.variationID) {
                item.variation = {
                    variationID: item.variationID,
                    variationName: item.fullVariationName || item.variationName,
                    variationSlug: item.variationSlug,
                    variationValues: formattedVariationValues,
                    variationPrice: item.variationPrice,
                    variationSalePrice: item.variationSalePrice,
                    variationStock: item.variationStock
                };
            }

            // Deep parse combo items featuredImage
            if (item.comboItems && Array.isArray(item.comboItems)) {
                item.comboItems = item.comboItems.map(comboItem => ({
                    ...comboItem,
                    featuredImage: safeParse(comboItem.featuredImage, [])
                }));
            }

            // Get address details if addressID exists
            if (item.addressID) {
                try {
                    const addressModel = require('./addressModel');
                    const address = await addressModel.getAddressByID(item.addressID);
                    if (address) {
                        const addressLine1 = address.line1 || address.addressLine1 || '';
                        const addressLine2 = address.line2 || address.addressLine2 || '';
                        const city = address.city || '';
                        const state = address.state || '';
                        const pincode = address.pincode || address.postalCode || '';
                        item.shippingAddress = `${addressLine1}${addressLine2 ? ', ' + addressLine2 : ''}, ${city}, ${state}${pincode ? ' - ' + pincode : ''}`.replace(/,\s*,/g, ', ').replace(/^,\s+|\s+,$/g, '');
                    }
                } catch (error) {
                    console.error('Error fetching address:', error);
                    item.shippingAddress = null;
                }
            }
        }

        return rows;
    } finally {
        connection.release();
    }
}

module.exports.getOrderItemsByUid = getOrderItemsByUid;

// Get order summaries (lightweight) for listing with pagination
async function getOrderSummaries(uid, page = 1, limit = 10, searchOrderID = null, status = null, sortField = null, sortOrder = null) {
    const connection = await db.getConnection();
    try {
        const offset = (page - 1) * limit;
        const params = [uid];
        let whereClause = 'WHERE od.uid = ?';

        // Add orderID filter with LIKE for partial match (if provided)
        if (searchOrderID) {
            // Convert to string and use LIKE for partial matching
            // Escape special LIKE characters (% and _) for safety
            const escapedOrderID = String(searchOrderID).replace(/[%_]/g, '\\$&');
            whereClause += ' AND od.orderID LIKE ?';
            params.push(`%${escapedOrderID}%`);
        }

        // Add status filter with exact match (if provided)
        // Validate against allowed enum values
        const allowedStatuses = ['pending', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned', 'partially_returned'];
        if (status && allowedStatuses.includes(String(status).toLowerCase())) {
            whereClause += ' AND od.orderStatus = ?';
            params.push(String(status).toLowerCase());
        }

        // Whitelist of safe sort fields (only fields that exist in orderDetail table)
        const allowedSortFields = ['orderID', 'total', 'paymentMode', 'paymentStatus', 'orderStatus', 'createdAt'];
        const defaultSortField = 'createdAt';
        const defaultSortOrder = 'DESC';

        // Validate and sanitize sortField
        let safeSortField = defaultSortField;
        if (sortField && allowedSortFields.includes(String(sortField))) {
            safeSortField = String(sortField);
        }

        // Validate and sanitize sortOrder
        let safeSortOrder = defaultSortOrder;
        if (sortOrder && (String(sortOrder).toUpperCase() === 'ASC' || String(sortOrder).toUpperCase() === 'DESC')) {
            safeSortOrder = String(sortOrder).toUpperCase();
        }

        // Build ORDER BY clause - use column alias for createdAt
        let orderByClause;
        if (safeSortField === 'createdAt') {
            orderByClause = `ORDER BY od.createdAt ${safeSortOrder}`;
        } else {
            // For other fields, use direct column reference
            orderByClause = `ORDER BY od.${safeSortField} ${safeSortOrder}`;
        }

        // Get paginated results with total count
        const [rows] = await connection.query(
            `SELECT 
                od.orderID,
                od.total,
                od.paymentMode,
                od.paymentStatus,
                od.orderStatus,
                od.createdAt as orderCreatedAt,
                COUNT(oi.orderID) as itemCount
             FROM orderDetail od
             LEFT JOIN order_items oi ON od.orderID = oi.orderID
             ${whereClause}
             GROUP BY od.orderID
             ${orderByClause}
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Get total count for pagination (without GROUP BY for count query)
        const [countRows] = await connection.query(
            `SELECT COUNT(DISTINCT od.orderID) as total
             FROM orderDetail od
             ${whereClause}`,
            params
        );

        return {
            data: rows,
            page: page,
            limit: limit,
            total: countRows[0].total,
            hasMore: offset + limit < countRows[0].total
        };
    } finally {
        connection.release();
    }
}

module.exports.getOrderSummaries = getOrderSummaries;

// Get single order details by orderID
async function getOrderDetailsByOrderID(orderID, uid) {
    const connection = await db.getConnection();
    try {
        // Get order items for specific order
        const [rows] = await connection.query(
            `SELECT oi.orderItemID, oi.orderID, oi.productID, oi.quantity, oi.variationID, oi.variationName AS storedVariationName,
                    oi.overridePrice, oi.salePrice, oi.regularPrice,
                    oi.unitPriceBefore, oi.unitPriceAfter,
                    oi.lineTotalBefore, oi.lineTotalAfter,
                    oi.offerID, oi.offerApplied, oi.offerStatus, oi.appliedOfferID,
                    oi.name, oi.featuredImage, oi.comboID, oi.referBy, oi.custom_inputs, oi.createdAt,
                    oi.trackingCode, oi.deliveryCompany, oi.itemStatus,
                    oi.returnStatus, oi.returnRequestedAt, oi.replacementOrderItemID, oi.replacementOrderID, oi.refundQueryID,
                    oi.returnTrackingCode, oi.returnDeliveryCompany, oi.returnTrackingUrl,
                    oi.earnedCoins, oi.coinLockUntil, oi.coinsReversed, oi.brandID, oi.brandShippingFee,
                    p.type AS productType, p.custom_inputs AS productCustomInputs,
                    v.variationName AS fullVariationName, v.variationSlug, v.variationValues,
                    v.variationPrice, v.variationStock, v.variationSalePrice,
                    od.paymentMode, od.paymentStatus, od.orderStatus, od.createdAt as orderCreatedAt,
                    od.addressID, od.total, od.deliveredAt, od.uid AS orderUid,
                    u.username, u.emailID as email, u.phoneNumber as contactNumber
             FROM order_items oi
             INNER JOIN orderDetail od ON oi.orderID = od.orderID
             LEFT JOIN products p ON oi.productID = p.productID
             LEFT JOIN variations v ON oi.variationID = v.variationID
             LEFT JOIN users u ON od.uid = u.uid
             WHERE od.orderID = ? AND od.uid = ?
             ORDER BY oi.createdAt ASC`,
            [orderID, uid]
        );

        // Utility: safe JSON parser (deep)
        const safeParse = (value, fallback = null) => {
            try {
                let parsed = value;
                while (typeof parsed === "string") parsed = JSON.parse(parsed);
                return parsed;
            } catch {
                return fallback;
            }
        };

        for (const item of rows) {
            if (item.comboID) {
                const cartModel = require('./cartModel');
                const comboItems = await cartModel.getComboItems(item.comboID);
                item.comboItems = comboItems;
            }

            item.featuredImage = safeParse(item.featuredImage, []);
            item.custom_inputs = safeParse(item.custom_inputs, null);
            item.productCustomInputs = safeParse(item.productCustomInputs, []);

            const variationValues = safeParse(item.variationValues, []);

            // Transform variationValues to {label, value} format if needed
            let formattedVariationValues = variationValues;
            if (Array.isArray(variationValues) && variationValues.length > 0) {
                // Check if it's already in {label, value} format
                const first = variationValues[0];
                if (first && !first.label && !first.value) {
                    // Transform from {Color: "Blue"} to {label: "Color", value: "Blue"}
                    formattedVariationValues = variationValues.map(obj => {
                        const entries = Object.entries(obj);
                        if (entries.length > 0) {
                            const [label, value] = entries[0];
                            return { label, value };
                        }
                        return obj;
                    });
                }
            }

            // Debug log
            if (item.variationID) {
                console.log(`[Order Model] getOrderDetailsByOrderID - Processing variation:`, {
                    variationID: item.variationID,
                    variationName: item.variationName,
                    fullVariationName: item.fullVariationName,
                    variationValues: item.variationValues,
                    parsedVariationValues: variationValues,
                    formattedVariationValues: formattedVariationValues
                });
            }

            if (item.variationID) {
                item.variation = {
                    variationID: item.variationID,
                    variationName: item.fullVariationName || item.variationName,
                    variationSlug: item.variationSlug,
                    variationValues: formattedVariationValues,
                    variationPrice: item.variationPrice,
                    variationSalePrice: item.variationSalePrice,
                    variationStock: item.variationStock
                };
            }

            if (item.comboItems && Array.isArray(item.comboItems)) {
                item.comboItems = item.comboItems.map(comboItem => ({
                    ...comboItem,
                    featuredImage: safeParse(comboItem.featuredImage, [])
                }));
            }
            console.log(item);

            // Get address details if addressID exists
            if (item.addressID) {
                try {
                    const addressModel = require('./addressModel');
                    const address = await addressModel.getAddressByID(item.addressID);
                    if (address) {
                        const addressLine1 = address.line1 || address.addressLine1 || '';
                        const addressLine2 = address.line2 || address.addressLine2 || '';
                        const city = address.city || '';
                        const state = address.state || '';
                        const pincode = address.pincode || address.postalCode || '';
                        item.shippingAddress = `${addressLine1}${addressLine2 ? ', ' + addressLine2 : ''}, ${city}, ${state}${pincode ? ' - ' + pincode : ''}`.replace(/,\s*,/g, ', ').replace(/^,\s+|\s+,$/g, '');
                    }
                } catch (error) {
                    console.error('Error fetching address:', error);
                    item.shippingAddress = null;
                }
            }
        }

        return rows;
    } finally {
        connection.release();
    }
}

module.exports.getOrderDetailsByOrderID = getOrderDetailsByOrderID;

// Get order by ID
async function getOrderByID(orderID) {
    const connection = await db.getConnection();
    try {
        const [rows] = await connection.query(
            'SELECT * FROM orderDetail WHERE orderID = ?',
            [orderID]
        );
        return rows[0] || null;
    } finally {
        connection.release();
    }
}

// Get order by merchant transaction ID
async function getOrderBymerchantID(merchantID) {
    const connection = await db.getConnection();
    try {
        const [rows] = await connection.query(
            'SELECT * FROM orderDetail WHERE merchantID = ?',
            [merchantID]
        );
        return rows[0] || null;
    } finally {
        connection.release();
    }
}

// Update order payment status
async function updateOrderPaymentStatus(merchantID, status) {
    const connection = await db.getConnection();
    try {
        const [result] = await connection.query(
            'UPDATE orderDetail SET paymentStatus = ? WHERE merchantID = ?',
            [status, merchantID]
        );
        return result.affectedRows > 0;
    } finally {
        connection.release();
    }
}

// Add merchant transaction ID to order
async function addmerchantID(orderID, merchantID) {
    const connection = await db.getConnection();
    try {
        const [result] = await connection.query(
            'UPDATE orderDetail SET merchantID = ? WHERE orderID = ?',
            [merchantID, orderID]
        );
        return result.affectedRows > 0;
    } finally {
        connection.release();
    }
}

module.exports.getOrderByID = getOrderByID;
module.exports.getOrderBymerchantID = getOrderBymerchantID;
module.exports.updateOrderPaymentStatus = updateOrderPaymentStatus;
module.exports.addmerchantID = addmerchantID;

// Update selected columns of an order by orderID (whitelisted fields only)
async function updateOrderByID(orderID, updateData = {}) {
    const connection = await db.getConnection();
    try {
        const allowedFields = new Set([
            'trackingID',
            'deliveryCompany',
            'paymentStatus',
            'paymentMode',
            'addressID',
            'subtotal',
            'total',
            'totalDiscount',
            'couponCode',
            'couponDiscount',
            'merchantID',
            'modified'
        ]);

        const fields = [];
        const values = [];

        for (const [key, val] of Object.entries(updateData)) {
            if (allowedFields.has(key)) {
                fields.push(`${key} = ?`);
                values.push(val);
            }
        }

        if (fields.length === 0) {
            return null;
        }

        values.push(orderID);

        const [result] = await connection.query(
            `UPDATE orderDetail SET ${fields.join(', ')} WHERE orderID = ?`,
            values
        );

        if (result.affectedRows === 0) return null;

        return await getOrderByID(orderID);
    } finally {
        connection.release();
    }
}

// --- Partial returns support ---
async function getOrderDetailForReturn(orderID, uid) {
    const [rows] = await db.query(
        'SELECT orderID, uid, orderStatus, total, deliveredAt, addressID FROM orderDetail WHERE orderID = ? AND uid = ?',
        [orderID, uid]
    );
    return rows[0] || null;
}

async function getOrderItemsForReturn(orderID, uid) {
    const [rows] = await db.query(
        `SELECT oi.orderItemID, oi.orderID, oi.productID, oi.quantity, oi.variationID, oi.variationName,
                oi.lineTotalAfter, oi.name, oi.featuredImage, oi.brandID, oi.referBy,
                oi.returnStatus, oi.earnedCoins, oi.coinsReversed, oi.itemStatus
         FROM order_items oi
         INNER JOIN orderDetail od ON oi.orderID = od.orderID
         WHERE oi.orderID = ? AND od.uid = ?
         ORDER BY oi.orderItemID ASC`,
        [orderID, uid]
    );
    return rows;
}

// Get all return items for a user (orders that have at least one item with return initiated/processing/etc.)
async function getMyReturns(uid) {
    const [rows] = await db.query(
        `SELECT od.orderID, od.createdAt AS orderCreatedAt, od.deliveredAt, od.orderStatus,
                oi.orderItemID, oi.productID, oi.name, oi.featuredImage, oi.quantity, oi.variationName, oi.lineTotalAfter,
                oi.returnStatus, oi.returnRequestedAt, oi.returnTrackingCode, oi.returnDeliveryCompany, oi.returnTrackingUrl,
                oi.replacementOrderID, oi.refundQueryID
         FROM order_items oi
         INNER JOIN orderDetail od ON oi.orderID = od.orderID
         WHERE od.uid = ? AND oi.returnStatus IS NOT NULL AND oi.returnStatus != 'none'
         ORDER BY oi.returnRequestedAt DESC, od.orderID DESC, oi.orderItemID ASC`,
        [uid]
    );
    return rows;
}

async function getOrderItemById(orderItemID, orderID, uid) {
    const [rows] = await db.query(
        `SELECT oi.* FROM order_items oi
         INNER JOIN orderDetail od ON oi.orderID = od.orderID
         WHERE oi.orderItemID = ? AND oi.orderID = ? AND od.uid = ?`,
        [orderItemID, orderID, uid]
    );
    return rows[0] || null;
}

async function updateOrderItemReturnStatus(orderItemID, updates, connection = null) {
    const { returnStatus, returnRequestedAt, replacementOrderItemID, replacementOrderID, refundQueryID, returnType, returnReason, returnComments, returnPhotos } = updates;
    const fields = ['returnStatus = ?'];
    const values = [returnStatus];
    
    if (returnRequestedAt !== undefined) { fields.push('returnRequestedAt = ?'); values.push(returnRequestedAt); }
    if (replacementOrderItemID !== undefined) { fields.push('replacementOrderItemID = ?'); values.push(replacementOrderItemID); }
    if (replacementOrderID !== undefined) { fields.push('replacementOrderID = ?'); values.push(replacementOrderID); }
    if (refundQueryID !== undefined) { fields.push('refundQueryID = ?'); values.push(refundQueryID); }
    if (returnType !== undefined) { fields.push('returnType = ?'); values.push(returnType); }
    if (returnReason !== undefined) { fields.push('returnReason = ?'); values.push(returnReason); }
    if (returnComments !== undefined) { fields.push('returnComments = ?'); values.push(returnComments); }
    if (returnPhotos !== undefined) { fields.push('returnPhotos = ?'); values.push(returnPhotos); }
    
    values.push(orderItemID);
    const conn = connection || db;
    const [result] = await conn.query(
        `UPDATE order_items SET ${fields.join(', ')} WHERE orderItemID = ?`,
        values
    );
    return result.affectedRows > 0;
}

async function getVariationStock(variationID) {
    if (!variationID) return null;
    const [rows] = await db.query('SELECT variationStock FROM variations WHERE variationID = ?', [variationID]);
    return rows[0] ? Number(rows[0].variationStock) : null;
}

// Create a new replacement order (0 Rs) with same uid and addressID; behaves like normal order for brand shipping
async function createReplacementOrder(connection, { uid, addressID, items }) {
    const txnID = require('crypto').randomUUID();
    const [detailResult] = await connection.query(
        `INSERT INTO orderDetail (uid, subtotal, total, totalDiscount, modified, txnID, createdAt, addressID, paymentMode, paymentStatus, couponCode, couponDiscount, referBy, isWalletUsed, paidWallet, handlingFee, handFeeRate, isReplacement)
         VALUES (?, 0, 0, 0, 0, ?, NOW(), ?, 'REPLACEMENT', 'successful', NULL, 0, NULL, 0, 0, 0, 0, 1)`,
        [uid, txnID, addressID]
    );
    const orderID = detailResult.insertId;
    for (const it of items) {
        const qty = Number(it.quantity) || 1;
        await connection.query(
            `INSERT INTO order_items (orderID, uid, productID, quantity, variationID, variationName, salePrice, regularPrice, unitPriceBefore, unitPriceAfter, lineTotalBefore, lineTotalAfter, name, featuredImage, brandID, referBy, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, ?, ?, '', NOW())`,
            [
                orderID,
                uid,
                it.productID,
                qty,
                it.variationID || null,
                it.variationName || null,
                it.name || null,
                it.featuredImage ? (typeof it.featuredImage === 'string' ? it.featuredImage : JSON.stringify(it.featuredImage)) : null,
                it.brandID || null
            ]
        );
        if (it.variationID) {
            await connection.query(
                'UPDATE variations SET variationStock = variationStock - ? WHERE variationID = ?',
                [qty, it.variationID]
            );
        }
    }
    return orderID;
}

async function getOrderItemsByOrderID(orderID) {
    const [rows] = await db.query(
        'SELECT orderItemID, orderID, returnStatus, earnedCoins, coinsReversed FROM order_items WHERE orderID = ?',
        [orderID]
    );
    return rows;
}

async function recomputeOrderStatusFromReturnItems(orderID) {
    const items = await getOrderItemsByOrderID(orderID);
    const returned = items.filter(i => ['returned', 'refund_completed', 'replacement_shipped', 'replacement_complete', 'return_initiated'].includes(String(i.returnStatus || 'none')));
    const allReturned = items.length > 0 && returned.length === items.length;
    const someReturned = returned.length > 0;
    let newStatus = null;
    if (allReturned) newStatus = 'returned';
    else if (someReturned) newStatus = 'partially_returned';
    if (newStatus) {
        await db.query('UPDATE orderDetail SET orderStatus = ? WHERE orderID = ?', [newStatus, orderID]);
    }
    return newStatus;
}

async function setDeliveredAt(orderID, deliveredAt) {
    const [result] = await db.query(
        'UPDATE orderDetail SET deliveredAt = ? WHERE orderID = ?',
        [deliveredAt, orderID]
    );
    if (result.affectedRows === 0) return false;
    const d = deliveredAt instanceof Date ? deliveredAt : new Date(deliveredAt);
    const lockUntil = new Date(d.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Set return window lock for all items on this order (normal or replacement)
    await db.query(
        'UPDATE order_items SET coinLockUntil = ? WHERE orderID = ?',
        [lockUntil, orderID]
    );

    // If this is a replacement order, also refresh the lock window
    // on the original items that point to this replacement order.
    await db.query(
        'UPDATE order_items SET coinLockUntil = ? WHERE replacementOrderID = ?',
        [lockUntil, orderID]
    );

    return true;
}

module.exports.updateOrderByID = updateOrderByID;
module.exports.getOrderDetailForReturn = getOrderDetailForReturn;
module.exports.getOrderItemsForReturn = getOrderItemsForReturn;
module.exports.getMyReturns = getMyReturns;
module.exports.getOrderItemById = getOrderItemById;
module.exports.updateOrderItemReturnStatus = updateOrderItemReturnStatus;
module.exports.getVariationStock = getVariationStock;
module.exports.createReplacementOrder = createReplacementOrder;
module.exports.getOrderItemsByOrderID = getOrderItemsByOrderID;
module.exports.recomputeOrderStatusFromReturnItems = recomputeOrderStatusFromReturnItems;
module.exports.setDeliveredAt = setDeliveredAt;
