const orderModel = require('./../model/orderModel')
const getCart = require('./../services/cartService')
const couponsModel = require('./../model/couponsModel')
const db = require('./../utils/dbconnect');
const usersModel = require('./../model/usersModel');
const affiliateModel = require('./../model/affiliateModel');
const invoiceService = require('./invoiceService');
const { addSendEmailJob } = require('../queue/emailProducer');
const { randomUUID } = require('crypto');
const cartModel = require('./../model/cartModel');

async function placeOrder(uid, addressID, paymentMode = 'cod', couponCode = null) {
    // Step 1: Process cart (offers, totals, summary)
    const cartData = await getCart.getCart(uid);

    if (!cartData.items || cartData.items.length === 0) {
        throw new Error('Cart is empty');
    }

    // Debug: Log cart data structure
    console.log('\n=== CART DATA DEBUG ===');
    console.log('Cart items count:', cartData.items.length);
    cartData.items.forEach((item, index) => {
        console.log(`Item ${index + 1}:`, {
            productID: item.productID,
            variationID: item.variationID,
            quantity: item.quantity,
            hasComboItems: !!(item.comboItems && Array.isArray(item.comboItems)),
            comboItemsCount: item.comboItems ? item.comboItems.length : 0
        });
    });

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

    // Step 5: Check if cart has referBy (centralized from cartDetail)
    const hasReferBy = cartData.items && cartData.items.length > 0 && cartData.items[0].referBy;
    const creditedUsers = new Set();

    // Step 6: Process referBy commissions (if referBy exists, no coupon commission)
    if (hasReferBy) {
        try {
            const referByUid = cartData.items[0].referBy; // All items have same referBy from cartDetail

            // Fetch referrer user
            const referrerUsers = await batchFetchUsers([referByUid]);
            const referrerUser = referrerUsers[0];

            if (referrerUser) {
                // Calculate total commission for this referrer (10% of item amounts)
                let totalCommission = 0;
                for (const item of cartData.items) {
                    const itemAmount = (item.salePrice || item.regularPrice || 0) * item.quantity;
                    totalCommission += itemAmount * 0.10;
                }

                if (totalCommission > 0) {
                    totalCommission = Math.round(totalCommission * 100) / 100;
                    creditedUsers.add(referrerUser.uid);

                    // Execute both operations in parallel
                    await Promise.all([
                        usersModel.incrementPendingPayment(referrerUser.uid, totalCommission),
                        affiliateModel.createAffiliateTransaction({
                            txnID: randomUUID(),
                            uid: referrerUser.uid,
                            status: 'pending',
                            amount: totalCommission,
                            type: 'incoming'
                        })
                    ]);
                }
            }
        } catch (referByError) {
            console.error('ReferBy processing error:', referByError);
            // Non-blocking
        }
    }

    // Step 7: Coupon commission (only if NO referBy exists)
    if (!hasReferBy && couponCode && couponDiscount >= 0) {
        try {
            const [couponResult] = await Promise.all([
                db.query('SELECT assignedUser FROM coupons WHERE couponCode = ? LIMIT 1', [couponCode])
            ]);

            const assignedUserEmail = couponResult[0] && couponResult[0][0] ? couponResult[0][0].assignedUser : null;

            if (assignedUserEmail) {
                const assignedUser = await usersModel.findUserByEmail(assignedUserEmail);

                if (assignedUser && assignedUser.uid && !creditedUsers.has(assignedUser.uid)) {
                    // 20% of order total (after discount)
                    const orderTotal = Number(finalSummary.total) || 0;
                    console.log('Order total:', orderTotal);

                    const commission = Math.round(orderTotal * 0.20 * 100) / 100;
                    console.log('Commission:', commission);


                    if (commission > 0) {
                        creditedUsers.add(assignedUser.uid);

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
        } catch (affiliateError) {
            console.error('Coupon commission error:', affiliateError);
            // Non-blocking
        }
    }

    return newOrder;
}


// Coupon validation and discount calculation
async function validateAndApplyCoupon(couponCode, cartData) {
    try {
        console.log('=== ORDER COUPON VALIDATION ===');
        console.log('Coupon code:', couponCode);
        console.log('Coupon code type:', typeof couponCode);
        console.log('Coupon code length:', couponCode ? couponCode.length : 'null');

        // Get coupon details by code
        const db = require('./../utils/dbconnect');

        // First, let's check if the coupon exists at all
        const [allCoupons] = await db.query(
            'SELECT * FROM coupons WHERE couponCode = ?',
            [couponCode]
        );
        console.log('All coupons with this code:', allCoupons);

        // Then check with usage limit
        const [couponRows] = await db.query(
            'SELECT * FROM coupons WHERE couponCode = ? AND (usageLimit IS NULL OR couponUsage < usageLimit)',
            [couponCode]
        );

        console.log('Coupon query result (with usage limit):', couponRows);
        console.log('Number of rows found:', couponRows ? couponRows.length : 'null');

        if (!couponRows || couponRows.length === 0) {
            console.log('Coupon validation failed - no rows found');
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

// Get order details by order ID
async function getOrderDetails(orderId, uid) {
    try {
        const order = await orderModel.getOrderByID(orderId);

        if (!order) {
            return null;
        }

        // Check if the order belongs to the user
        if (order.uid !== uid) {
            return null;
        }

        // Get order items from order_items table
        const [items] = await db.query(
            `SELECT oi.productID, oi.quantity, oi.variationID, oi.variationName,
                    oi.overridePrice, oi.salePrice, oi.regularPrice,
                    oi.unitPriceBefore, oi.unitPriceAfter,
                    oi.lineTotalBefore, oi.lineTotalAfter,
                    oi.offerID, oi.offerApplied, oi.offerStatus, oi.appliedOfferID,
                    oi.name, oi.featuredImage, oi.comboID, oi.referBy, oi.createdAt
             FROM order_items oi
             WHERE oi.orderID = ? AND oi.uid = ?
             ORDER BY oi.createdAt ASC`,
            [orderId, uid]
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

        const processedItems = [];
        for (const item of items) {
            // Load combo items if applicable
            if (item.comboID) {
                item.comboItems = await cartModel.getComboItems(item.comboID);
            }

            // Deep parse featuredImage
            const parsedFeaturedImage = safeParse(item.featuredImage, []);

            // Deep parse combo items featuredImage
            const processedComboItems = (item.comboItems || []).map(comboItem => ({
                ...comboItem,
                featuredImage: safeParse(comboItem.featuredImage, [])
            }));

            processedItems.push({
                productID: item.productID,
                quantity: Number(item.quantity) || 0,
                variationID: item.variationID,
                variationName: item.variationName,
                salePrice: Number(item.salePrice) || 0,
                regularPrice: Number(item.regularPrice) || 0,
                lineTotalAfter: Number(item.lineTotalAfter) || 0,
                name: item.name,
                featuredImage: Array.isArray(parsedFeaturedImage) ? parsedFeaturedImage : [],
                createdAt: item.createdAt,
                comboItems: processedComboItems
            });
        }

        // Get address details
        let deliveryAddress = null;
        if (order.addressID) {
            try {
                const addressResult = await db.query(
                    'SELECT * FROM address WHERE addressID = ? AND uid = ?',
                    [order.addressID, uid]
                );
                if (addressResult[0] && addressResult[0].length > 0) {
                    const addr = addressResult[0][0];
                    // Clean up address response - only send necessary fields
                    deliveryAddress = {
                        emailID: addr.emailID,
                        phoneNumber: addr.phoneNumber,
                        line1: addr.line1,
                        line2: addr.line2,
                        city: addr.city,
                        state: addr.state,
                        pincode: addr.pincode,
                        landmark: addr.landmark,
                        type: addr.type
                    };
                }
            } catch (e) {
                console.error('Error fetching address:', e);
            }
        }

        // Build final response
        return {
            orderID: order.orderID,
            uid: order.uid,
            paymentMode: order.paymentMode,
            paymentStatus: order.paymentStatus || 'successful',
            status: order.status || 'confirmed',
            createdAt: order.createdAt,
            items: processedItems,
            subtotal: Number(order.subtotal) || 0,
            discount: Number(order.totalDiscount) || 0,
            shipping: 0,
            total: Number(order.total) || 0,
            deliveryAddress,
            couponCode: order.couponCode,
            couponDiscount: Number(order.couponDiscount) || 0
        };
    } catch (error) {
        console.error('Error in getOrderDetails service:', error);
        throw error;
    }
}

// Get all orders for admin with pagination and filters
async function getAllOrders(filters = {}) {
    try {
        const { page = 1, limit = 10, offset = 0, status, paymentStatus, search } = filters;

        let whereConditions = [];
        let queryParams = [];

        // Build WHERE clause based on filters
        if (status) {
            whereConditions.push('od.orderStatus = ?');
            queryParams.push(status);
        }

        if (paymentStatus) {
            whereConditions.push('od.paymentStatus = ?');
            queryParams.push(paymentStatus);
        }

        if (search) {
            whereConditions.push('(od.orderID LIKE ? OR u.username LIKE ? OR u.emailID LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Get total count
        const countQuery = `
            SELECT COUNT(DISTINCT od.orderID) as total
            FROM orderDetail od
            LEFT JOIN users u ON od.uid = u.uid
            ${whereClause}
        `;

        const [countResult] = await db.query(countQuery, queryParams);
        const total = countResult[0]?.total || 0;

        // Get orders with pagination
        const ordersQuery = `
            SELECT DISTINCT 
                od.orderID,
                od.uid,
                od.paymentMode,
                od.paymentStatus,
                od.orderStatus,
                od.subtotal,
                od.totalDiscount,
                od.total,
                od.couponCode,
                od.couponDiscount,
                od.createdAt,
                u.username,
                u.emailID,
                u.phonenumber,
                COUNT(oi.orderID) as itemCount
            FROM orderDetail od
            LEFT JOIN users u ON od.uid = u.uid
            LEFT JOIN order_items oi ON od.orderID = oi.orderID
            ${whereClause}
            GROUP BY od.orderID, od.uid, od.paymentMode, od.paymentStatus, od.orderStatus, 
                     od.subtotal, od.totalDiscount, od.total, od.couponCode, od.couponDiscount, 
                     od.createdAt, u.username, u.emailID, u.phonenumber
            ORDER BY od.createdAt DESC
            LIMIT ? OFFSET ?
        `;

        const [orders] = await db.query(ordersQuery, [...queryParams, parseInt(limit), parseInt(offset)]);

        return {
            orders: orders.map(order => ({
                orderID: order.orderID,
                uid: order.uid,
                username: order.username,
                emailID: order.emailID,
                phonenumber: order.phonenumber,
                paymentMode: order.paymentMode,
                paymentStatus: order.paymentStatus,
                orderStatus: order.orderStatus,
                subtotal: parseFloat(order.subtotal) || 0,
                totalDiscount: parseFloat(order.totalDiscount) || 0,
                total: parseFloat(order.total) || 0,
                couponCode: order.couponCode,
                couponDiscount: parseFloat(order.couponDiscount) || 0,
                itemCount: order.itemCount,
                createdAt: order.createdAt
            })),
            total: parseInt(total)
        };
    } catch (error) {
        console.error('Error in getAllOrders service:', error);
        throw error;
    }
}

// Update order status
async function updateOrderStatus(orderId, orderStatus) {
    try {
        const result = await db.query(
            'UPDATE orderDetail SET orderStatus = ? WHERE orderID = ?',
            [orderStatus, orderId]
        );

        if (result[0].affectedRows === 0) {
            return null;
        }

        // Return updated order
        const [updatedOrder] = await db.query(
            'SELECT * FROM orderDetail WHERE orderID = ?',
            [orderId]
        );

        return updatedOrder[0];
    } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
    }
}

// Update payment status
async function updatePaymentStatus(orderId, paymentStatus) {
    try {
        const result = await db.query(
            'UPDATE orderDetail SET paymentStatus = ? WHERE orderID = ?',
            [paymentStatus, orderId]
        );

        if (result[0].affectedRows === 0) {
            return null;
        }

        // Return updated order
        const [updatedOrder] = await db.query(
            'SELECT * FROM orderDetail WHERE orderID = ?',
            [orderId]
        );

        return updatedOrder[0];
    } catch (error) {
        console.error('Error updating payment status:', error);
        throw error;
    }
}

// Generate invoice data
async function generateInvoice(orderId) {
    try {
        // Get order details using admin function
        const orderDetails = await getAdminOrderDetails(orderId);

        if (!orderDetails) {
            return null;
        }

        // Generate invoice data
        const invoiceData = invoiceService.generateInvoiceData(orderDetails);

        // Generate PDF buffer
        const pdfBuffer = await invoiceService.generateInvoicePDF(invoiceData);

        return {
            success: true,
            invoice: {
                orderId: orderDetails.orderID,
                invoiceNumber: invoiceData.invoiceNumber,
                pdfBuffer: pdfBuffer,
                fileName: `invoice_${orderDetails.orderID}.pdf`,
                mimeType: 'application/pdf',
                generatedAt: invoiceData.generatedAt
            },
            data: invoiceData
        };
    } catch (error) {
        console.error('Error generating invoice:', error);
        throw error;
    }
}

module.exports.updateOrder = updateOrder;
module.exports.getOrderDetails = getOrderDetails;

// Get order details for admin (no uid required)
async function getAdminOrderDetails(orderId) {
    try {
        const order = await orderModel.getOrderByID(orderId);

        if (!order) {
            return null;
        }

        // Get order items from order_items table
        const [items] = await db.query(
            `SELECT oi.productID, oi.quantity, oi.variationID, oi.variationName,
                    oi.overridePrice, oi.salePrice, oi.regularPrice,
                    oi.unitPriceBefore, oi.unitPriceAfter,
                    oi.lineTotalBefore, oi.lineTotalAfter,
                    oi.offerID, oi.offerApplied, oi.offerStatus, oi.appliedOfferID,
                    oi.name, oi.featuredImage, oi.comboID, oi.referBy, oi.createdAt
             FROM order_items oi
             WHERE oi.orderID = ?
             ORDER BY oi.createdAt ASC`,
            [orderId]
        );

        // Parse featuredImage for each item if it's a JSON string
        const processedItems = items.map(item => {
            let parsedFeaturedImage = [];

            if (item.featuredImage && typeof item.featuredImage === 'string') {
                try {
                    // Handle double-encoded JSON strings
                    let jsonString = item.featuredImage;
                    if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
                        jsonString = JSON.parse(jsonString);
                    }
                    parsedFeaturedImage = JSON.parse(jsonString);
                } catch (e) {
                    console.error('Error parsing featuredImage:', e);
                    parsedFeaturedImage = [];
                }
            } else if (Array.isArray(item.featuredImage)) {
                parsedFeaturedImage = item.featuredImage;
            }

            // Convert string prices to numbers for consistency
            const salePrice = parseFloat(item.salePrice) || 0;
            const regularPrice = parseFloat(item.regularPrice) || 0;
            const lineTotalAfter = parseFloat(item.lineTotalAfter) || 0;

            // Clean up the response - only send necessary fields
            return {
                productID: item.productID,
                quantity: item.quantity,
                variationID: item.variationID,
                variationName: item.variationName,
                salePrice: salePrice,
                regularPrice: regularPrice,
                lineTotalAfter: lineTotalAfter,
                name: item.name,
                featuredImage: parsedFeaturedImage, // This will be a proper array
                createdAt: item.createdAt
            };
        });

        // Get address details
        let deliveryAddress = null;
        if (order.addressID) {
            try {
                const addressResult = await db.query(
                    'SELECT * FROM address WHERE addressID = ?',
                    [order.addressID]
                );
                if (addressResult[0] && addressResult[0].length > 0) {
                    const addr = addressResult[0][0];
                    // Clean up address response - only send necessary fields
                    deliveryAddress = {
                        emailID: addr.emailID,
                        phoneNumber: addr.phoneNumber,
                        line1: addr.line1,
                        line2: addr.line2,
                        city: addr.city,
                        state: addr.state,
                        pincode: addr.pincode,
                        landmark: addr.landmark,
                        type: addr.type
                    };
                }
            } catch (e) {
                console.error('Error fetching address:', e);
            }
        }

        // Format the response
        const orderDetails = {
            orderID: order.orderID,
            uid: order.uid,
            paymentMode: order.paymentMode,
            paymentStatus: order.paymentStatus || 'successful',
            orderStatus: order.orderStatus || 'Preparing', // Use orderStatus instead of status
            createdAt: order.createdAt,
            items: processedItems,
            subtotal: parseFloat(order.subtotal) || 0,
            discount: parseFloat(order.totalDiscount) || 0,
            shipping: 0, // Shipping is not stored separately in current schema
            total: parseFloat(order.total) || 0,
            deliveryAddress: deliveryAddress,
            couponCode: order.couponCode,
            couponDiscount: parseFloat(order.couponDiscount) || 0
        };

        return orderDetails;
    } catch (error) {
        console.error('Error in getAdminOrderDetails service:', error);
        throw error;
    }
}

// Email invoice to customer
async function emailInvoice(orderId) {
    try {
        // Get order details
        const orderDetails = await getAdminOrderDetails(orderId);
        if (!orderDetails) {
            return { success: false, message: 'Order not found' };
        }

        // Check if order has delivery address with email
        if (!orderDetails.deliveryAddress || !orderDetails.deliveryAddress.emailID) {
            return { success: false, message: 'Customer email not found' };
        }

        // Generate invoice data and PDF
        const invoiceData = invoiceService.generateInvoiceData(orderDetails);
        const pdfBuffer = await invoiceService.generateInvoicePDF(invoiceData);

        // Prepare email data for queue
        const emailData = {
            to: orderDetails.deliveryAddress.emailID,
            templateName: 'invoice-email',
            variables: {
                customerName: orderDetails.deliveryAddress.emailID.split('@')[0], // Use email prefix as name
                orderId: orderDetails.orderID,
                invoiceNumber: invoiceData.invoiceNumber,
                orderDate: new Date(orderDetails.createdAt).toLocaleDateString('en-IN'),
                totalAmount: orderDetails.total.toFixed(2),
                paymentMode: orderDetails.paymentMode,
                orderStatus: orderDetails.orderStatus
            },
            subject: `Invoice for Order #${orderDetails.orderID} - Ithyaraa`,
            attachments: [
                {
                    filename: `invoice_${orderDetails.orderID}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        // Add email job to queue
        await addSendEmailJob(emailData);

        return {
            success: true,
            message: 'Invoice email queued successfully',
            email: orderDetails.deliveryAddress.emailID
        };
    } catch (error) {
        console.error('Error sending invoice email:', error);
        return { success: false, message: 'Failed to send invoice email' };
    }
}

module.exports.getAdminOrderDetails = getAdminOrderDetails;
module.exports.getAllOrders = getAllOrders;
module.exports.updateOrderStatus = updateOrderStatus;
module.exports.updatePaymentStatus = updatePaymentStatus;
module.exports.generateInvoice = generateInvoice;
module.exports.emailInvoice = emailInvoice;

// HELPER FUNCTIONS

// Fetch users by UIDs
async function batchFetchUsers(uids) {
    if (uids.length === 0) return [];

    const placeholders = uids.map(() => '?').join(',');
    const [rows] = await db.query(
        `SELECT uid, username, emailID, phonenumber, balance, pendingPayment FROM users WHERE uid IN (${placeholders})`,
        uids
    );
    return rows;
}