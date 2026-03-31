const orderModel = require('./../model/orderModel')
const settingsModel = require('./../model/settingsModel')
const getCart = require('./../services/cartService')
const couponsModel = require('./../model/couponsModel')
const db = require('./../utils/dbconnect');
const usersModel = require('./../model/usersModel');
const affiliateModel = require('./../model/affiliateModel');
const invoiceService = require('./invoiceService');
const { addSendEmailJob } = require('../queue/emailProducer');
const { queueOrderStatusEmail } = require('./orderStatusEmailService');
const { randomUUID } = require('crypto');
const cartModel = require('./../model/cartModel');
const coinModel = require('../model/coinModel');
const settlementService = require('./settlementService');

async function placeOrder(uid, addressID, paymentMode = 'cod', couponCode = null, walletApplied = 0) {
    // Step 1: Process cart (offers, totals, summary)
    const cartData = await getCart.getCart(uid);
    console.log(cartData);


    if (!cartData.items || cartData.items.length === 0) {
        throw new Error('Cart is empty');
    }

    // Filter to only include selected items for checkout
    const selectedItems = cartData.items.filter(item =>
        item.selected === true || item.selected === 1 || item.selected === null
    );

    if (!selectedItems || selectedItems.length === 0) {
        throw new Error('No selected items in cart. Please select items to checkout.');
    }

    // Recalculate summary for selected items only (same as cart: subtotal = sum(regularPrice * quantity))
    const subtotal = Number(selectedItems.reduce((sum, i) => sum + (Number(i.regularPrice) || 0) * (Number(i.quantity) || 0), 0).toFixed(2));
    const total = Number(selectedItems.reduce((sum, i) => sum + (i.lineTotalAfter || 0), 0).toFixed(2));
    const totalDiscount = Number((subtotal - total).toFixed(2));
    cartData.summary = { ...cartData.summary, subtotal, total, totalDiscount };
    cartData.items = selectedItems;

    // Debug: Log cart data structure
    console.log('\n=== CART DATA DEBUG (SELECTED ITEMS ONLY) ===');
    console.log('Selected items count:', selectedItems.length);
    selectedItems.forEach((item, index) => {
        console.log(`Item ${index + 1}:`, {
            productID: item.productID,
            variationID: item.variationID,
            quantity: item.quantity,
            hasComboItems: !!(item.comboItems && Array.isArray(item.comboItems)),
            comboItemsCount: item.comboItems ? item.comboItems.length : 0,
            selected: item.selected
        });
    });

    // Step 2: Handle coupon validation and discount calculation
    let couponDiscount = 0;
    let finalSummary = { ...cartData.summary };

    if (couponCode) {
        try {
            const couponResult = await validateAndApplyCoupon(couponCode, cartData, uid);
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

    // Step 3: Normalize total and apply wallet balance (split pay)
    // Total should be: subtotal - totalDiscount + shipping (keep original, don't modify)
    const baseSubtotal = Math.max(0, Number(finalSummary.subtotal) || 0);
    const baseDiscount = Math.max(0, Number(finalSummary.totalDiscount) || 0);

    // Calculate Shipping Fee: Brand-Specific + Inhouse (Admin)
    let baseShipping = 0;
    const subtotalAfterDiscount = baseSubtotal - baseDiscount;

    if (subtotalAfterDiscount < 999) {
        const uniqueBrandIDs = [...new Set(selectedItems.filter(i => i.brandID).map(i => i.brandID))];
        const hasInhouse = selectedItems.some(i => !i.brandID || i.productType === 'combo' || i.productType === 'customproduct');
        
        const brandShippingMap = uniqueBrandIDs.length > 0 ? await cartModel.getBrandShippingCharges(uniqueBrandIDs) : new Map();
        const globalShippingFee = hasInhouse ? (Number(await settingsModel.getSetting('shipping_fee')) || 50) : 0;

        const processedBrands = new Set();
        let inhouseShippingAssigned = false;
        let totalShippingFee = 0;

        selectedItems.forEach(item => {
            item.brandShippingFee = 0; // Default
            if (item.brandID) {
                if (!processedBrands.has(item.brandID)) {
                    const fee = brandShippingMap.get(item.brandID) || 0;
                    item.brandShippingFee = fee;
                    totalShippingFee += fee;
                    processedBrands.add(item.brandID);
                }
            } else if (!inhouseShippingAssigned && (item.productType === 'combo' || item.productType === 'customproduct' || !item.brandID)) {
                item.brandShippingFee = globalShippingFee;
                totalShippingFee += globalShippingFee;
                inhouseShippingAssigned = true;
            }
        });
        
        baseShipping = totalShippingFee;
    } else {
        baseShipping = 0; // Free shipping above 999
        selectedItems.forEach(item => { item.brandShippingFee = 0; });
    }
    
    finalSummary.shippingFee = baseShipping;

    // Add handling fee for COD orders (8 INR)
    const HANDLING_FEE_RATE = 8.00;
    const isCOD = paymentMode === 'COD' || paymentMode === 'cod';
    const handlingFee = isCOD ? HANDLING_FEE_RATE : 0;

    const originalTotal = Math.max(0, baseSubtotal - baseDiscount + baseShipping + handlingFee);
    // Ensure summary reflects normalized total (original, not reduced by wallet)
    finalSummary.total = originalTotal;
    finalSummary.handlingFee = handlingFee;
    finalSummary.handFeeRate = isCOD ? HANDLING_FEE_RATE : 0;

    let paidWallet = 0;
    let isWalletUsed = false;
    try {
        const requested = Math.max(0, Number(walletApplied) || 0);
        if (requested > 0) {
            const user = await usersModel.findByuid(uid);
            const available = Math.max(0, Number(user?.balance || 0));
            const payableBeforeWallet = originalTotal;
            paidWallet = Math.min(requested, available, payableBeforeWallet);
            if (paidWallet > 0) {
                isWalletUsed = true;
                // Deduct wallet from user balance (don't modify finalSummary.total)
                await db.query('UPDATE users SET balance = balance - ? WHERE uid = ?', [paidWallet, uid]);
                // Calculate remaining payable (for payment mode decision only)
                const remainingPayable = Math.max(0, payableBeforeWallet - paidWallet);
                // If fully paid via wallet, set paymentMode to FULL_COIN
                if (remainingPayable <= 0) {
                    paymentMode = 'FULL_COIN';
                }
                // Note: finalSummary.total remains as originalTotal (not reduced)
            }
        }
    } catch (walletErr) {
        console.error('Wallet apply error:', walletErr);
        // continue without wallet deduction
    }

    // Step 4: Store order using processed cart data with new fields
    // Resolve shipping snapshot from address table for this addressID
    const addressModel = require('../model/addressModel');
    const address = await addressModel.getAddressByID(addressID);
    const newOrder = await orderModel.createOrder({
        uid,
        addressID,
        shippingName: null, // name not stored on address; keep null or derive elsewhere if needed
        shippingPhone: address ? (address.phoneNumber || address.phonenumber || '') : '',
        shippingEmail: address ? (address.emailID || address.email || '') : '',
        shippingLine1: address ? (address.line1 || address.addressLine1 || '') : '',
        shippingLine2: address ? (address.line2 || address.addressLine2 || '') : '',
        shippingCity: address ? (address.city || '') : '',
        shippingState: address ? (address.state || '') : '',
        shippingPincode: address ? (address.pincode || '') : '',
        shippingLandmark: address ? (address.landmark || '') : '',
        paymentMode,
        couponCode,
        couponDiscount,
        items: cartData.items,
        summary: finalSummary,
        isWalletUsed: isWalletUsed ? 1 : 0,
        paidWallet: paidWallet,
        handlingFee: isCOD ? 1 : 0,
        handFeeRate: isCOD ? HANDLING_FEE_RATE : 0
    });

    // Step 5: Record coupon usage only after successful order (COD = successful at place order; PREPAID = recorded in webhook on payment success)
    if (couponCode && couponDiscount > 0 && (paymentMode === 'COD' || paymentMode === 'cod' || paymentMode === 'FULL_COIN')) {
        try {
            await couponsModel.recordCouponUsageForOrder(couponCode, uid, newOrder.orderID);
        } catch (error) {
            console.error('Failed to record coupon usage:', error);
            // Don't throw - order is already created
        }
    }

    // Step 5.1: Record settlement 'order_placed' event (on hold, 0 effect for now)
    const [orderItemsForSettle] = await db.query('SELECT orderItemID FROM order_items WHERE orderID = ?', [newOrder.orderID]);
    for (const item of orderItemsForSettle) {
        const sResult = await settlementService.recordEvent({
            orderItemID: item.orderItemID,
            event: 'order_placed',
            effect: 'hold',
            notes: 'Order placed'
        });
        if (!sResult.success) {
            await settlementService.logFailure(item.orderItemID, 'order_placed', { orderID: newOrder.orderID }, sResult.error);
        }
    }

    // Step 6: Check if cart has referBy (centralized from cartDetail)
    const hasReferBy = cartData.items && cartData.items.length > 0 && cartData.items[0].referBy;
    const creditedUsers = new Set();

    // Step 7: Process referBy commissions (if referBy exists, no coupon commission)
    if (hasReferBy) {
        try {
            const referByUid = cartData.items[0].referBy; // All items have same referBy from cartDetail

            // Self-referral not allowed: ordering person must not be the referrer
            if (referByUid === uid) {
                console.log('[Refer] Skipping refer commission: self-referral not allowed');
            } else {
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

                    // Execute both operations in parallel (link to order for delivery/return handling)
                    await Promise.all([
                        usersModel.incrementPendingPayment(referrerUser.uid, totalCommission),
                        affiliateModel.createAffiliateTransaction({
                            txnID: randomUUID(),
                            uid: referrerUser.uid,
                            status: 'pending',
                            amount: totalCommission,
                            type: 'incoming',
                            orderID: newOrder.orderID
                        })
                    ]);
                }
            }
            }
        } catch (referByError) {
            console.error('ReferBy processing error:', referByError);
            // Non-blocking
        }
    }

    // Step 8: Coupon commission (only if NO referBy exists)
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
                                type: 'incoming',
                                orderID: newOrder.orderID
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

    // Step 9: Create pending coins (1 coin per ₹100 of total) - will be completed on delivery
    try {
        const totalRupees = Number(finalSummary.total) || 0;
        const coins = Math.floor(totalRupees / 100);
        if (coins > 0) {
            await coinModel.createPendingCoins(uid, newOrder.orderID, coins);
            // Persist on orderDetail.coinsEarned (for display purposes, even though pending)
            await db.query(`UPDATE orderDetail SET coinsEarned = ? WHERE orderID = ?`, [coins, newOrder.orderID]);
        }
    } catch (coinErr) {
        console.error('Failed to create pending coins:', coinErr);
        // Non-blocking
    }

    return newOrder;
}


// Coupon validation and discount calculation (uid required for per-user usage limit)
async function validateAndApplyCoupon(couponCode, cartData, uid) {
    try {
        console.log('=== ORDER COUPON VALIDATION ===');
        console.log('UID:', uid);
        console.log('Coupon code (raw):', couponCode);
        console.log('Coupon code type:', typeof couponCode);
        console.log('Coupon code length:', couponCode ? couponCode.length : 'null');

        const db = require('./../utils/dbconnect');

        // Global usage limit check
        const [couponRows] = await db.query(
            'SELECT * FROM coupons WHERE couponCode = ? AND (usageLimit IS NULL OR couponUsage < usageLimit)',
            [couponCode]
        );

        console.log('Order coupon query result:', couponRows);

        if (!couponRows || couponRows.length === 0) {
            console.log('Coupon validation failed - no rows or usage limit reached');
            return { success: false, message: 'Invalid or expired coupon code' };
        }

        const coupon = couponRows[0];
        console.log('Order coupon row:', coupon);

        // Per-user usage limit (maxUsagePerUser: NULL = unlimited, 1 = single use, N = N times)
        if (uid && coupon.maxUsagePerUser != null && Number(coupon.maxUsagePerUser) >= 0) {
            const usedByUser = await couponsModel.getCouponUsageCountByUser(coupon.couponID, uid);
            console.log('Order maxUsagePerUser:', coupon.maxUsagePerUser, 'usedByUser:', usedByUser);
            if (usedByUser >= Number(coupon.maxUsagePerUser)) {
                console.log('Order coupon rejected due to per-user usage limit.');
                return {
                    success: false,
                    message: 'You have already used this coupon the maximum number of times.'
                };
            }
        }

        // Calculate subtotal for eligible products (variable only, no offer) using lineTotalBefore
        let subtotal = 0;

        cartData.items.forEach(item => {
            const lineBefore = item.lineTotalBefore != null
                ? Number(item.lineTotalBefore)
                : (Number(item.salePrice) || Number(item.regularPrice) || 0) * (item.quantity || 1);

            const hasNoOffer =
                item.offerID === null ||
                item.offerID === undefined ||
                item.offerID === '';

            // Eligible only when:
            // - Variable product
            // - Not under any offer (offerID === null/undefined/"")
            if (hasNoOffer && item.type === 'variable') {
                subtotal += lineBefore;
            }
        });

        // Order-level subtotal for min-order check (all selected items) from cart summary
        const orderSubtotal = cartData.summary && cartData.summary.subtotal != null
            ? Number(cartData.summary.subtotal)
            : subtotal;

        console.log('Order orderSubtotal (before coupon, summary.subtotal):', orderSubtotal);
        console.log('Order eligible subtotal (before coupon, lineTotalBefore eligible):', subtotal);

        if (subtotal === 0) {
            return {
                success: false,
                message: 'No eligible products found for this coupon. Coupons can only be applied to variable products without offers.'
            };
        }

        // Minimum order value (minOrderValue: NULL = no minimum) - based on eligible subtotal only
        const minOrder = coupon.minOrderValue != null ? Number(coupon.minOrderValue) : null;
        console.log('Order minOrderValue from DB:', minOrder);
        if (minOrder != null && minOrder > 0 && subtotal < minOrder) {
            console.log('Order coupon rejected due to minOrderValue. eligible subtotal:', subtotal);
            return {
                success: false,
                message: `Minimum order value of ₹${minOrder} required for this coupon`
            };
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            discount = subtotal * (Number(coupon.discountValue) / 100);
        } else if (coupon.discountType === 'flat') {
            discount = Number(coupon.discountValue);
        }
        if (isNaN(discount)) discount = 0;
        if (discount > subtotal) discount = subtotal;

        console.log('Order coupon discount computed:', discount);

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

async function getOrderSummaries(uid, page, limit, searchOrderID, status, sortField, sortOrder) {
    return await orderModel.getOrderSummaries(uid, page, limit, searchOrderID, status, sortField, sortOrder);
}

async function getOrderDetailsByOrderID(orderID, uid) {
    // Fetch items for this order and the corresponding orderDetail row
    const items = await orderModel.getOrderDetailsByOrderID(orderID, uid);
    const orderDetail = await orderModel.getOrderByID(orderID);

    // Ensure the order belongs to the requesting user
    if (orderDetail && orderDetail.uid !== uid) {
        return { items: [], orderDetail: null };
    }

    // Add handling fee fields and shipping breakdown to orderDetail
    if (orderDetail) {
        orderDetail.handlingFee = orderDetail.handlingFee ? Boolean(Number(orderDetail.handlingFee)) : false;
        orderDetail.handFeeRate = Number(orderDetail.handFeeRate) || 0;

        // Calculate historical itemTotal: based strictly on (regularPrice * quantity)
        // or effectively subtotal + discount to keep it simple and accurate.
        // It reflects the total value before any overall order level discount.
        orderDetail.itemTotal = (Number(orderDetail.subtotal) || 0) + (Number(orderDetail.totalDiscount) || 0);

        // Calculate shipping breakdown
        const shippingBreakdownMap = new Map();
        let inhouseShipping = 0;

        // Fetch brand names if we have any brand IDs
        const uniqueBrandIDs = [...new Set(items.filter(i => i.brandID).map(i => i.brandID))];
        const brandNameMap = new Map();
        
        if (uniqueBrandIDs.length > 0) {
            try {
                const [brandRows] = await db.query(
                    `SELECT uid, username FROM users WHERE uid IN (?) AND role = 'brand'`,
                    [uniqueBrandIDs]
                );
                brandRows.forEach(b => brandNameMap.set(b.uid, b.username));
            } catch (err) {
                console.error('Error fetching brand names for shipping breakdown:', err);
            }
        }

        items.forEach(item => {
            const fee = Number(item.brandShippingFee) || 0;
            if (item.brandID && fee > 0) {
                if (!shippingBreakdownMap.has(item.brandID)) {
                    shippingBreakdownMap.set(item.brandID, {
                        brandID: item.brandID,
                        brandName: brandNameMap.get(item.brandID) || 'Unknown Brand',
                        fee: fee
                    });
                }
            } else if (!item.brandID && fee > 0) {
                // Inhouse or combo item shipping fee
                inhouseShipping = Math.max(inhouseShipping, fee);
            }
        });

        const shippingBreakdown = Array.from(shippingBreakdownMap.values());
        if (inhouseShipping > 0) {
            shippingBreakdown.push({
                brandID: 'inhouse',
                brandName: 'Inhouse',
                fee: inhouseShipping
            });
        }

        orderDetail.shippingBreakdown = shippingBreakdown;
    }

    return { items, orderDetail };
}

module.exports.getOrderItemsByUid = getOrderItemsByUid;
module.exports.getOrderSummaries = getOrderSummaries;
module.exports.getOrderDetailsByOrderID = getOrderDetailsByOrderID;

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
                    oi.name, oi.featuredImage, oi.comboID, oi.referBy, oi.custom_inputs, oi.createdAt,
                    oi.brandID, p.brand AS productBrand, p.type AS productType, p.custom_inputs AS productCustomInputs,
                    v.variationName AS fullVariationName, v.variationSlug, v.variationValues,
                    v.variationPrice, v.variationStock, v.variationSalePrice,
                    u.username AS brandName
             FROM order_items oi
             LEFT JOIN products p ON oi.productID = p.productID
             LEFT JOIN variations v ON oi.variationID = v.variationID
             LEFT JOIN users u ON oi.brandID = u.uid AND u.role = 'brand'
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

            // Deep parse custom_inputs
            const parsedCustomInputs = safeParse(item.custom_inputs, null);

            // Deep parse product custom inputs (field definitions)
            const parsedProductCustomInputs = safeParse(item.productCustomInputs, []);

            // Parse variation values
            const variationValues = safeParse(item.variationValues, []);

            // Deep parse combo items featuredImage and add brand info
            const processedComboItems = await Promise.all((item.comboItems || []).map(async (comboItem) => {
                // Get brand info for combo item
                let comboBrandName = 'Inhouse';
                if (comboItem.brandID) {
                    try {
                        const [brandRows] = await db.query(
                            `SELECT username FROM users WHERE uid = ? AND role = 'brand' LIMIT 1`,
                            [comboItem.brandID]
                        );
                        if (brandRows && brandRows.length > 0) {
                            comboBrandName = brandRows[0].username;
                        } else if (comboItem.brand) {
                            comboBrandName = comboItem.brand;
                        }
                    } catch (e) {
                        console.error('Error fetching brand for combo item:', e);
                        if (comboItem.brand) comboBrandName = comboItem.brand;
                    }
                } else if (comboItem.brand) {
                    comboBrandName = comboItem.brand;
                }

                return {
                    ...comboItem,
                    featuredImage: safeParse(comboItem.featuredImage, []),
                    brandName: comboBrandName
                };
            }));

            // Build full variation object
            const fullVariation = item.variationID ? {
                variationID: item.variationID,
                variationName: item.fullVariationName || item.variationName,
                variationSlug: item.variationSlug,
                variationValues: variationValues,
                variationPrice: item.variationPrice,
                variationSalePrice: item.variationSalePrice,
                variationStock: item.variationStock
            } : null;

            // Determine brand name: use brandName from users table, fallback to productBrand, or "Inhouse" if brandID is null
            const brandName = item.brandID
                ? (item.brandName || item.productBrand || 'Unknown Brand')
                : 'Inhouse';

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
                custom_inputs: parsedCustomInputs,
                productCustomInputs: parsedProductCustomInputs,
                createdAt: item.createdAt,
                comboItems: processedComboItems,
                variation: fullVariation,
                brandID: item.brandID,
                brandName: brandName
            });
        }

        // Get delivery address from snapshot when available; fall back to address table for legacy orders.
        let deliveryAddress = null;
        const hasSnapshot =
            order.shippingLine1 ||
            order.shippingLine2 ||
            order.shippingCity ||
            order.shippingState ||
            order.shippingPincode ||
            order.shippingLandmark ||
            order.shippingPhone ||
            order.shippingEmail;

        if (hasSnapshot) {
            deliveryAddress = {
                emailID: order.shippingEmail || '',
                phoneNumber: order.shippingPhone || '',
                line1: order.shippingLine1 || '',
                line2: order.shippingLine2 || '',
                city: order.shippingCity || '',
                state: order.shippingState || '',
                pincode: order.shippingPincode || '',
                landmark: order.shippingLandmark || '',
                type: null
            };
        } else if (order.addressID) {
            try {
                const addressResult = await db.query(
                    'SELECT * FROM address WHERE addressID = ? AND uid = ?',
                    [order.addressID, uid]
                );
                if (addressResult[0] && addressResult[0].length > 0) {
                    const addr = addressResult[0][0];
                    deliveryAddress = {
                        emailID: addr.emailID,
                        phoneNumber: addr.phoneNumber || addr.phonenumber || '',
                        line1: addr.line1 || addr.addressLine1 || '',
                        line2: addr.line2 || addr.addressLine2 || '',
                        city: addr.city || '',
                        state: addr.state || '',
                        pincode: addr.pincode || '',
                        landmark: addr.landmark || '',
                        type: addr.type || null
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
            couponDiscount: Number(order.couponDiscount) || 0,
            handlingFee: order.handlingFee ? Boolean(Number(order.handlingFee)) : false,
            handFeeRate: Number(order.handFeeRate) || 0
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
        // Get order details before updating to check for pending coins
        const [orderBefore] = await db.query(
            'SELECT uid, orderStatus, coinsEarned FROM orderDetail WHERE orderID = ?',
            [orderId]
        );

        if (!orderBefore || orderBefore.length === 0) {
            return null;
        }

        const normalizedStatus = String(orderStatus).toLowerCase();

        const order = orderBefore[0];
        const oldStatus = order.orderStatus;
        const uid = order.uid;
        const hasPendingCoins = order.coinsEarned > 0;

        // Update order status (stored in lowercase for consistency)
        const result = await db.query(
            'UPDATE orderDetail SET orderStatus = ? WHERE orderID = ?',
            [normalizedStatus, orderId]
        );

        if (result[0].affectedRows === 0) {
            return null;
        }

        // Set deliveredAt and per-item coinLockUntil when order becomes Delivered
        if (normalizedStatus === 'delivered' && oldStatus !== 'delivered') {
            const orderModel = require('../model/orderModel');
            await orderModel.setDeliveredAt(orderId, new Date());

            // Settlement Hook: Record 'order_delivered' (Hold) with actual amount
            const [orderItems] = await db.query('SELECT orderItemID FROM order_items WHERE orderID = ?', [orderId]);
            for (const item of orderItems) {
                const sResult = await settlementService.recordEvent({
                    orderItemID: item.orderItemID,
                    event: 'order_delivered',
                    effect: 'hold',
                    notes: 'Order delivered - earnings on hold'
                });
                if (!sResult.success) {
                    await settlementService.logFailure(item.orderItemID, 'order_delivered', { orderId }, sResult.error);
                }
            }
        }
        
        // Settlement Hook: Record 'cancelled' if order is cancelled
        if (normalizedStatus === 'cancelled' && oldStatus !== 'cancelled') {
            const [orderItems] = await db.query('SELECT orderItemID FROM order_items WHERE orderID = ?', [orderId]);
            for (const item of orderItems) {
                const sResult = await settlementService.recordEvent({
                    orderItemID: item.orderItemID,
                    event: 'cancelled',
                    effect: 'neutral',
                    notes: 'Order cancelled'
                });
                if (!sResult.success) {
                    await settlementService.logFailure(item.orderItemID, 'cancelled', { orderId }, sResult.error);
                }
            }
        }

        // Handle coin state transitions based on status change
        const coinsAmount = order.coinsEarned || 0;
        const wasReturnedOrCancelled = (oldStatus === 'Cancelled' || oldStatus === 'Returned');
        const isNowReturnedOrCancelled = (orderStatus === 'Cancelled' || orderStatus === 'Returned');

        if (hasPendingCoins || coinsAmount > 0) {
            try {
                if (orderStatus === 'Delivered' && oldStatus !== 'Delivered') {
                    if (wasReturnedOrCancelled && coinsAmount > 0) {
                        const reapplyResult = await coinModel.reapplyCoinsForOrder(uid, orderId, coinsAmount, 'order');
                        if (reapplyResult.success) {
                            console.log(`[Coins] Re-applied ${reapplyResult.coinsReapplied} coins for order ${orderId} (status back to Delivered, source: ${reapplyResult.source})`);
                        }
                    } else {
                        await coinModel.completePendingCoins(uid, orderId);
                        console.log(`[Coins] Completed pending coins for order ${orderId}`);
                    }
                } else if (isNowReturnedOrCancelled && !wasReturnedOrCancelled) {
                    if (oldStatus === 'Delivered') {
                        const result = await coinModel.reverseEarnedCoins(uid, orderId);
                        if (result.success) {
                            console.log(`[Coins] Reversed ${result.coinsReversed} earned coins for ${orderStatus.toLowerCase()} order ${orderId}`);
                        } else {
                            console.log(`[Coins] ${result.message} for order ${orderId}`);
                        }
                    } else {
                        await coinModel.reversePendingCoins(uid, orderId);
                        console.log(`[Coins] Reversed pending coins for ${orderStatus.toLowerCase()} order ${orderId}`);
                    }
                } else if (wasReturnedOrCancelled && !isNowReturnedOrCancelled && orderStatus !== 'Delivered' && coinsAmount > 0) {
                    const reapplyResult = await coinModel.reapplyCoinsToPending(uid, orderId, coinsAmount, 'order');
                    if (reapplyResult.success) {
                        console.log(`[Coins] Re-applied ${coinsAmount} coins as pending for order ${orderId} (status back to ${orderStatus})`);
                    }
                }
            } catch (coinErr) {
                console.error('[Coins] Error processing coin state change:', coinErr);
                // Don't fail the order status update if coin processing fails
            }
        }

        // Handle affiliate refer settlement: on delivery confirm (lock until return period); on return/cancel revert; on revert back from return/cancel re-apply
        try {
            const wasReturnedOrCancelled = (oldStatus === 'Cancelled' || oldStatus === 'Returned');
            const isNowReturnedOrCancelled = (orderStatus === 'Cancelled' || orderStatus === 'Returned');

            if (orderStatus === 'Delivered' && oldStatus !== 'Delivered') {
                if (wasReturnedOrCancelled) {
                    const reapplyResult = await affiliateModel.reapplyReferSettlementOnDelivery(orderId, new Date());
                    if (reapplyResult.updated > 0) {
                        console.log(`[Affiliate] Re-applied ${reapplyResult.updated} refer settlement(s) for order ${orderId} (status back to Delivered)`);
                    }
                } else {
                    const confirmResult = await affiliateModel.confirmReferSettlementOnDelivery(orderId, new Date());
                    if (confirmResult.updated > 0) {
                        console.log(`[Affiliate] Confirmed ${confirmResult.updated} refer settlement(s) for order ${orderId} (locked until return period)`);
                    }
                }
            } else if (isNowReturnedOrCancelled && !wasReturnedOrCancelled) {
                if (oldStatus === 'Delivered') {
                    const revertResult = await affiliateModel.revertReferSettlementOnReturn(orderId);
                    if (revertResult.reverted > 0) {
                        console.log(`[Affiliate] Reverted ${revertResult.reverted} refer settlement(s) for ${orderStatus.toLowerCase()} order ${orderId}`);
                    }
                } else {
                    const cancelResult = await affiliateModel.revertPendingReferSettlementOnCancel(orderId);
                    if (cancelResult.reverted > 0) {
                        console.log(`[Affiliate] Reverted ${cancelResult.reverted} pending refer settlement(s) for cancelled order ${orderId}`);
                    }
                }
            } else if (wasReturnedOrCancelled && !isNowReturnedOrCancelled && orderStatus !== 'Delivered') {
                const reapplyPendingResult = await affiliateModel.reapplyReferSettlementToPending(orderId);
                if (reapplyPendingResult.updated > 0) {
                    console.log(`[Affiliate] Re-applied ${reapplyPendingResult.updated} refer settlement(s) to pending for order ${orderId} (status back to ${orderStatus})`);
                }
            }
        } catch (affiliateErr) {
            console.error('[Affiliate] Error processing refer settlement on order status change:', affiliateErr);
            // Don't fail the order status update
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
            `SELECT oi.orderItemID, oi.productID, oi.quantity, oi.variationID, oi.variationName,
                    oi.overridePrice, oi.salePrice, oi.regularPrice,
                    oi.unitPriceBefore, oi.unitPriceAfter,
                    oi.lineTotalBefore, oi.lineTotalAfter,
                    oi.offerID, oi.offerApplied, oi.offerStatus, oi.appliedOfferID,
                    oi.name, oi.featuredImage, oi.comboID, oi.referBy, oi.custom_inputs, oi.createdAt,
                    oi.trackingCode, oi.deliveryCompany, oi.itemStatus,
                    oi.returnStatus, oi.returnTrackingCode, oi.returnDeliveryCompany, oi.replacementOrderID,
                    oi.brandID, p.brand AS productBrand, p.type AS productType, p.custom_inputs AS productCustomInputs,
                    v.variationName AS fullVariationName, v.variationSlug, v.variationValues,
                    v.variationPrice, v.variationStock, v.variationSalePrice,
                    u.username AS brandName
             FROM order_items oi
             LEFT JOIN products p ON oi.productID = p.productID
             LEFT JOIN variations v ON oi.variationID = v.variationID
             LEFT JOIN users u ON oi.brandID = u.uid AND u.role = 'brand'
             WHERE oi.orderID = ?
             ORDER BY oi.createdAt ASC`,
            [orderId]
        );

        // Utility function to safely parse JSON
        const safeParse = (value, fallback = null) => {
            if (!value) return fallback;
            if (typeof value === 'string') {
                try {
                    let parsed = value;
                    while (typeof parsed === "string") parsed = JSON.parse(parsed);
                    return parsed;
                } catch (e) {
                    return fallback;
                }
            }
            return value;
        };

        // Parse featuredImage and custom_inputs for each item if it's a JSON string
        const processedItems = [];
        for (const item of items) {
            // Load combo items if applicable
            let comboItems = [];
            if (item.comboID) {
                comboItems = await cartModel.getComboItems(item.comboID);
            }

            let parsedFeaturedImage = safeParse(item.featuredImage, []);
            let parsedCustomInputs = safeParse(item.custom_inputs, null);
            let productCustomInputs = safeParse(item.productCustomInputs, []);
            let variationValues = safeParse(item.variationValues, []);

            // Deep parse combo items featuredImage and add brand info
            const processedComboItems = await Promise.all((comboItems || []).map(async (comboItem) => {
                // Get brand info for combo item
                let comboBrandName = 'Inhouse';
                if (comboItem.brandID) {
                    try {
                        const [brandRows] = await db.query(
                            `SELECT username FROM users WHERE uid = ? AND role = 'brand' LIMIT 1`,
                            [comboItem.brandID]
                        );
                        if (brandRows && brandRows.length > 0) {
                            comboBrandName = brandRows[0].username;
                        } else if (comboItem.brand) {
                            comboBrandName = comboItem.brand;
                        }
                    } catch (e) {
                        console.error('Error fetching brand for combo item:', e);
                        if (comboItem.brand) comboBrandName = comboItem.brand;
                    }
                } else if (comboItem.brand) {
                    comboBrandName = comboItem.brand;
                }

                return {
                    ...comboItem,
                    featuredImage: safeParse(comboItem.featuredImage, []),
                    brandName: comboBrandName
                };
            }));

            // Convert string prices to numbers for consistency
            const salePrice = parseFloat(item.salePrice) || 0;
            const regularPrice = parseFloat(item.regularPrice) || 0;
            const lineTotalAfter = parseFloat(item.lineTotalAfter) || 0;

            // Determine brand name: use brandName from users table, fallback to productBrand, or "Inhouse" if brandID is null
            const brandName = item.brandID
                ? (item.brandName || item.productBrand || 'Unknown Brand')
                : 'Inhouse';

            // Clean up the response - only send necessary fields
            processedItems.push({
                orderItemID: item.orderItemID,
                productID: item.productID,
                quantity: item.quantity,
                variationID: item.variationID,
                variationName: item.variationName,
                salePrice: salePrice,
                regularPrice: regularPrice,
                lineTotalAfter: lineTotalAfter,
                name: item.name,
                featuredImage: parsedFeaturedImage,
                custom_inputs: parsedCustomInputs,
                productCustomInputs: productCustomInputs,
                createdAt: item.createdAt,
                trackingCode: item.trackingCode || null,
                deliveryCompany: item.deliveryCompany || null,
                itemStatus: item.itemStatus || 'pending',
                returnStatus: item.returnStatus || 'none',
                returnTrackingCode: item.returnTrackingCode || null,
                returnDeliveryCompany: item.returnDeliveryCompany || null,
                replacementOrderID: item.replacementOrderID || null,
                comboItems: processedComboItems,
                brandID: item.brandID,
                brandName: brandName,
                // Full variation details
                variation: item.variationID ? {
                    variationID: item.variationID,
                    variationName: item.fullVariationName || item.variationName,
                    variationSlug: item.variationSlug,
                    variationValues: variationValues,
                    variationPrice: item.variationPrice,
                    variationSalePrice: item.variationSalePrice,
                    variationStock: item.variationStock
                } : null
            });
        }

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
            couponDiscount: parseFloat(order.couponDiscount) || 0,
            handlingFee: order.handlingFee ? Boolean(Number(order.handlingFee)) : false,
            handFeeRate: parseFloat(order.handFeeRate) || 0
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

        // Convert Buffer to base64 for queue serialization
        const base64Content = pdfBuffer.toString('base64');

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
                    content: base64Content, // Store as base64 string for queue
                    contentType: 'application/pdf',
                    encoding: 'base64' // Flag to indicate this needs decoding
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

// Email invoice to customer (user-facing endpoint)
async function emailInvoiceToCustomer(orderId, uid) {
    try {
        // Get order details - verify ownership
        const orderDetails = await getOrderDetails(orderId, uid);
        if (!orderDetails) {
            return { success: false, message: 'Order not found or you do not have permission to access this order' };
        }

        // Check if order has delivery address with email
        if (!orderDetails.deliveryAddress || !orderDetails.deliveryAddress.emailID) {
            return { success: false, message: 'Customer email not found' };
        }

        // Generate invoice data and PDF
        const invoiceData = invoiceService.generateInvoiceData(orderDetails);
        const pdfBuffer = await invoiceService.generateInvoicePDF(invoiceData);

        // Convert Buffer to base64 for queue serialization
        const base64Content = pdfBuffer.toString('base64');

        // Get current timestamp for "Invoice Requested on" context
        const requestedTimestamp = new Date().toLocaleString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });

        // Prepare email data for queue
        const emailData = {
            to: orderDetails.deliveryAddress.emailID,
            templateName: 'invoice-request-email',
            variables: {
                customerName: orderDetails.deliveryAddress.emailID.split('@')[0], // Use email prefix as name
                orderId: orderDetails.orderID,
                invoiceNumber: invoiceData.invoiceNumber,
                orderDate: new Date(orderDetails.createdAt).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                totalAmount: orderDetails.total.toFixed(2),
                paymentMode: orderDetails.paymentMode,
                orderStatus: orderDetails.orderStatus,
                requestedTimestamp: requestedTimestamp
            },
            subject: `Invoice Requested on ${requestedTimestamp} - Order #${orderDetails.orderID} - Ithyaraa`,
            attachments: [
                {
                    filename: `invoice_${orderDetails.orderID}.pdf`,
                    content: base64Content, // Store as base64 string for queue
                    contentType: 'application/pdf',
                    encoding: 'base64' // Flag to indicate this needs decoding
                }
            ]
        };

        // Add email job to queue
        await addSendEmailJob(emailData);

        return {
            success: true,
            message: 'Invoice email queued successfully',
            email: orderDetails.deliveryAddress.emailID,
            requestedTimestamp: requestedTimestamp
        };
    } catch (error) {
        console.error('Error sending invoice email to customer:', error);
        return { success: false, message: 'Failed to send invoice email: ' + error.message };
    }
}

// Partial return: validate 7-day window, replacement or refund_query, coin/affiliate reversal, order status
async function returnOrder(uid, { orderID, orderItemID = null, reason = null }) {
    const orderModel = require('../model/orderModel');
    const refundQueryModel = require('../model/refundQueryModel');

    const order = await orderModel.getOrderDetailForReturn(orderID, uid);
    if (!order) {
        throw new Error('Order not found or access denied');
    }
    const items = await orderModel.getOrderItemsForReturn(orderID, uid);
    let targetItems;
    if (orderItemID) {
        const one = items.find(i => Number(i.orderItemID) === Number(orderItemID));
        if (!one) throw new Error('Order item not found');
        if ((one.returnStatus || 'none') !== 'none') throw new Error('This item is already in return process');
        targetItems = [one];
    } else {
        targetItems = items.filter(i => (i.returnStatus || 'none') === 'none');
        if (targetItems.length === 0) throw new Error('No eligible items to return');
    }
    // Check delivery at order_items level: each item being returned must be delivered
    for (const it of targetItems) {
        const itemStatus = String(it.itemStatus || '').toLowerCase();
        if (itemStatus !== 'delivered') {
            throw new Error('Return is only allowed for delivered items. This item is not yet marked as delivered.');
        }
    }
    // Use orderDetail.deliveredAt for 7-day return window (set when order was marked Delivered)
    const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
    if (!deliveredAt || isNaN(deliveredAt.getTime())) {
        throw new Error('Delivery date is not set for this order');
    }
    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (now.getTime() - deliveredAt.getTime() > sevenDaysMs) {
        throw new Error('Return window has expired (7 days after delivery)');
    }

    const orderTotal = Number(order.total) || 0;
    const refundPendingIds = [];
    const itemsForReturnInitiatedEmail = [];
    const itemsForRefundPendingEmail = [];

    for (const item of targetItems) {
        const qty = Number(item.quantity) || 1;
        const stock = item.variationID ? await orderModel.getVariationStock(item.variationID) : null;
        const hasStock = stock != null && stock >= qty;

        if (hasStock) {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                if (!order.addressID) {
                    throw new Error('Order address not found; cannot create replacement order');
                }
                const replacementOrderID = await orderModel.createReplacementOrder(connection, {
                    uid: order.uid,
                    addressID: order.addressID,
                    items: [{
                        productID: item.productID,
                        quantity: item.quantity,
                        variationID: item.variationID,
                        variationName: item.variationName,
                        name: item.name,
                        featuredImage: item.featuredImage,
                        brandID: item.brandID
                    }]
                });
                await orderModel.updateOrderItemReturnStatus(
                    item.orderItemID,
                    {
                        returnStatus: 'return_initiated',
                        returnRequestedAt: new Date(),
                        replacementOrderID
                    },
                    connection
                );
                await connection.commit();
                itemsForReturnInitiatedEmail.push(item);

                // Settlement Hook: Record 'replacement_original' (Wait for admin Phase 1 credit)
                const sResultOriginal = await settlementService.recordEvent({
                    orderItemID: item.orderItemID,
                    event: 'replacement_original',
                    effect: 'hold', // Changed from 'debit' to 'hold' so it stays as eligible for Phase 1 credit
                    notes: `Replacement initiated (Replacement Order: ${replacementOrderID}). Waiting for admin confirmation.`
                });
                if (!sResultOriginal.success) {
                    await settlementService.logFailure(item.orderItemID, 'replacement_original', { replacementOrderID }, sResultOriginal.error);
                }

                // Settlement Hook: Record 'replacement_item' (Neutral) for the new item
                const [newItems] = await db.query('SELECT orderItemID FROM order_items WHERE orderID = ?', [replacementOrderID]);
                for (const ni of newItems) {
                    const sResultItem = await settlementService.recordEvent({
                        orderItemID: ni.orderItemID,
                        event: 'replacement_item',
                        effect: 'neutral',
                        notes: `Replacement item for item ${item.orderItemID}`,
                        relatedOrderItemId: item.orderItemID // Track back to original
                    });
                    if (!sResultItem.success) {
                        await settlementService.logFailure(ni.orderItemID, 'replacement_item', { originalItemID: item.orderItemID }, sResultItem.error);
                    }
                }
            } catch (e) {
                await connection.rollback();
                throw e;
            } finally {
                connection.release();
            }
        } else {
            const rq = await refundQueryModel.createRefundQuery({
                orderID,
                orderItemID: item.orderItemID,
                productID: item.productID,
                userID: String(uid),
                brandID: item.brandID,
                reason: reason || null
            });
            await orderModel.updateOrderItemReturnStatus(item.orderItemID, {
                returnStatus: 'refund_pending',
                returnRequestedAt: new Date(),
                refundQueryID: rq.refundQueryID
            });
            refundPendingIds.push(item.orderItemID);
            itemsForRefundPendingEmail.push(item);
        }
    }

    try {
        const [userRows] = await db.query('SELECT emailID, name, username FROM users WHERE uid = ? LIMIT 1', [order.uid]);
        const user = userRows && userRows[0] ? userRows[0] : null;
        const customerName = (user && (user.name || user.username)) || 'Customer';
        const toEmail = user && user.emailID ? user.emailID : null;
        if (toEmail) {
            for (const item of itemsForReturnInitiatedEmail) {
                await queueOrderStatusEmail({
                    to: toEmail,
                    customerName,
                    orderID,
                    itemName: item.name || 'Item',
                    variationName: item.variationName || '',
                    statusType: 'return_initiated'
                });
            }
            for (const item of itemsForRefundPendingEmail) {
                await queueOrderStatusEmail({
                    to: toEmail,
                    customerName,
                    orderID,
                    itemName: item.name || 'Item',
                    variationName: item.variationName || '',
                    statusType: 'refund_pending'
                });
            }
        }
    } catch (emailErr) {
        console.error('[Return] Error queueing status emails:', emailErr);
    }

    for (const item of targetItems) {
        const coins = Number(item.earnedCoins) || 0;
        if (coins > 0 && !item.coinsReversed) {
            try {
                const revResult = await coinModel.reverseEarnedCoinsForItem(uid, orderID, item.orderItemID, coins);
                if (revResult && revResult.success) {
                    await db.query('UPDATE order_items SET coinsReversed = 1 WHERE orderItemID = ?', [item.orderItemID]);
                }
            } catch (e) {
                console.error('[Return] Coin reversal error for item', item.orderItemID, e);
            }
        }
        const referBy = item.referBy && String(item.referBy).trim();
        if (referBy && orderTotal > 0) {
            try {
                await affiliateModel.deductAffiliateEarningsForReturnedItem(
                    orderID,
                    item.orderItemID,
                    Number(item.lineTotalAfter) || 0,
                    orderTotal,
                    referBy
                );
            } catch (e) {
                console.error('[Return] Affiliate deduction error for item', item.orderItemID, e);
            }
        }
    }

    await orderModel.recomputeOrderStatusFromReturnItems(orderID);

    const message = refundPendingIds.length > 0
        ? 'Return requested. Some items could not be replaced; our executive will contact you for refund.'
        : 'Return request submitted successfully.';
    return { success: true, message, refundPending: refundPendingIds.length > 0 };
}

module.exports.getAdminOrderDetails = getAdminOrderDetails;
module.exports.getAllOrders = getAllOrders;
module.exports.updateOrderStatus = updateOrderStatus;
module.exports.returnOrder = returnOrder;
module.exports.updatePaymentStatus = updatePaymentStatus;
module.exports.generateInvoice = generateInvoice;
module.exports.emailInvoice = emailInvoice;
module.exports.emailInvoiceToCustomer = emailInvoiceToCustomer;

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