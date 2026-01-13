const db = require('./../utils/dbconnect')
const { randomUUID } = require('crypto');


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
            `INSERT INTO orderDetail (uid, subtotal, total, totalDiscount, modified, txnID, createdAt, addressID, paymentMode, paymentStatus, trackingID, deliveryCompany, couponCode, couponDiscount, referBy, isWalletUsed, paidWallet, handlingFee, handFeeRate) 
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderData.uid,
                orderData.summary.subtotal,
                orderData.summary.total,
                orderData.summary.totalDiscount,
                orderData.summary.anyModifications ? 1 : 0,
                generatedTxnID,
                orderData.addressID,
                orderData.paymentMode || 'cod',
                paymentStatus,
                orderData.trackingID || null,
                orderData.deliveryCompany || null,
                orderData.couponCode || null,
                orderData.couponDiscount || 0.00,
                orderReferBy || null,
                orderData.isWalletUsed || 0,
                orderData.paidWallet || 0.00,
                orderData.handlingFee || 0,
                orderData.handFeeRate || 0.00
            ]
        );
        const orderID = detailResult.insertId;

        // 2. Insert order_items and deduct stock
        for (const item of orderData.items) {
            await connection.query(
                `INSERT INTO order_items (
                    orderID, uid, productID, quantity,
                    variationID, variationName,
                    overridePrice, salePrice, regularPrice,
                    unitPriceBefore, unitPriceAfter,
                    lineTotalBefore, lineTotalAfter,
                    offerID, offerApplied, offerStatus, appliedOfferID,
                    name, featuredImage, comboID, brandID, referBy, custom_inputs, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
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
                    (item.referBy !== undefined && item.referBy !== null) ? item.referBy : '',
                    item.custom_inputs ? JSON.stringify(item.custom_inputs) : null
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
        // Get cartItemIDs of items that were included in the order
        const cartItemIDs = orderData.items.map(item => item.cartItemID).filter(id => id != null);

        console.log('\n=== CART CLEANUP DEBUG ===');
        console.log('Total items in order:', orderData.items.length);
        console.log('CartItemIDs to delete:', cartItemIDs);
        console.log('UID:', orderData.uid);

        if (cartItemIDs.length > 0) {
            const placeholders = cartItemIDs.map(() => '?').join(',');
            // Use a new connection for cart cleanup (after transaction commit)
            const cleanupConnection = await db.getConnection();
            try {
                // First, verify which items will be deleted (for debugging)
                const [itemsToDelete] = await cleanupConnection.query(
                    `SELECT cartItemID, productID, selected FROM cart_items WHERE uid = ? AND cartItemID IN (${placeholders}) AND (selected = TRUE OR selected = 1)`,
                    [orderData.uid, ...cartItemIDs]
                );
                console.log('Items that will be deleted (selected = TRUE):', itemsToDelete);

                // Explicitly check selected = TRUE to ensure only selected items are deleted
                const [deleteResult] = await cleanupConnection.query(
                    `DELETE FROM cart_items WHERE uid = ? AND cartItemID IN (${placeholders}) AND (selected = TRUE OR selected = 1)`,
                    [orderData.uid, ...cartItemIDs]
                );
                console.log('Deleted rows:', deleteResult.affectedRows);

                // Check if cart is now empty, and if so, clear cartDetail
                const [remainingItems] = await cleanupConnection.query(
                    `SELECT COUNT(*) as count FROM cart_items WHERE uid = ?`,
                    [orderData.uid]
                );
                console.log('Remaining items in cart:', remainingItems[0].count);

                if (remainingItems[0].count === 0) {
                    await cleanupConnection.query(`DELETE FROM cartDetail WHERE uid = ?`, [orderData.uid]);
                    console.log('CartDetail cleared (cart is empty)');
                }
            } finally {
                cleanupConnection.release();
            }
        } else {
            console.log('WARNING: No cartItemIDs found in order items. Cart will not be cleared.');
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
            `SELECT oi.orderID, oi.productID, oi.quantity, oi.variationID, oi.variationName,
                    oi.overridePrice, oi.salePrice, oi.regularPrice,
                    oi.unitPriceBefore, oi.unitPriceAfter,
                    oi.lineTotalBefore, oi.lineTotalAfter,
                    oi.offerID, oi.offerApplied, oi.offerStatus, oi.appliedOfferID,
                    oi.name, oi.featuredImage, oi.comboID, oi.referBy, oi.custom_inputs, oi.createdAt,
                    p.type AS productType, p.custom_inputs AS productCustomInputs,
                    v.variationName AS fullVariationName, v.variationSlug, v.variationValues,
                    v.variationPrice, v.variationStock, v.variationSalePrice,
                    od.paymentMode, od.paymentStatus, od.orderStatus, od.createdAt as orderCreatedAt,
                    od.addressID, u.username, u.emailID as email, u.phoneNumber as contactNumber
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
        const allowedStatuses = ['pending', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned'];
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
            `SELECT oi.orderID, oi.productID, oi.quantity, oi.variationID, oi.variationName AS storedVariationName,
                    oi.overridePrice, oi.salePrice, oi.regularPrice,
                    oi.unitPriceBefore, oi.unitPriceAfter,
                    oi.lineTotalBefore, oi.lineTotalAfter,
                    oi.offerID, oi.offerApplied, oi.offerStatus, oi.appliedOfferID,
                    oi.name, oi.featuredImage, oi.comboID, oi.referBy, oi.custom_inputs, oi.createdAt,
                    oi.trackingCode, oi.deliveryCompany, oi.itemStatus,
                    p.type AS productType, p.custom_inputs AS productCustomInputs,
                    v.variationName AS fullVariationName, v.variationSlug, v.variationValues,
                    v.variationPrice, v.variationStock, v.variationSalePrice,
                    od.paymentMode, od.paymentStatus, od.orderStatus, od.createdAt as orderCreatedAt,
                    od.addressID, od.total, u.username, u.emailID as email, u.phoneNumber as contactNumber
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

module.exports.updateOrderByID = updateOrderByID;
