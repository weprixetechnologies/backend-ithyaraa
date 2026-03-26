const argon2 = require('argon2');
const { randomUUID } = require('crypto');
const db = require('../utils/dbconnect');
const { generateAccessToken } = require('../utils/tokenUtils');
const orderModel = require('../model/orderModel');
const coinModel = require('../model/coinModel');

// PhonePe config – mirror existing integration
const crypto = require('crypto');

const merchantId = process.env.MERCHANT_ID || 'PGTESTPAYUAT86';
const key = process.env.KEY || '96434309-7796-489d-8924-ab56988a6076';
const keyIndex = process.env.KEY_INDEX || '1';

if (process.env.NODE_ENV === 'production') {
    if (!merchantId || !key || !keyIndex) {
        throw new Error('Missing PhonePe production credentials');
    }
}

const phonePeUrl =
    process.env.NODE_ENV === 'production'
        ? 'https://api.phonepe.com/apis/hermes/pg/v1/pay'
        : 'https://api-preprod.phonepe.com/apis/hermes/pg/v1/pay';

function generateChecksum(base64Payload) {
    const path = '/pg/v1/pay';
    const raw = base64Payload + path + key;
    const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
    return `${sha256}###${keyIndex}`;
}

// Helpers
function generateRandomString(length, charset) {
    const chars = charset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateUid() {
    return `ITHY_UID_${generateRandomString(8, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')}`;
}

function generateUsername(email) {
    const prefix = (email && email.split('@')[0]) || 'user';
    return `${prefix}_${generateRandomString(4, '0123456789')}`;
}

function generateAddressId() {
    return `ADDR_${generateRandomString(10, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')}`;
}

function generateComboInstanceId() {
    return `COIT${generateRandomString(9, '0123456789')}`;
}

/**
 * Lightweight coupon validation for Buy Now (single product, no cart).
 * GET /api/order/buy-now/validate-coupon?code=...&subtotal=...&email=...&uid=...
 */
const validateCoupon = async (req, res) => {
    try {
        const code = (req.query.code || '').trim();
        const rawSubtotal = req.query.subtotal;
        const email = (req.query.email || '').trim();

        console.log('[BuyNow][ValidateCoupon] Incoming request:', {
            code,
            rawSubtotal,
            email,
        });

        if (!code) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_COUPON',
                message: 'Coupon code is required',
            });
        }

        const subtotal = Number(rawSubtotal);
        if (isNaN(subtotal) || subtotal <= 0) {
            console.warn('[BuyNow][ValidateCoupon] Invalid subtotal:', rawSubtotal);
            return res.status(400).json({
                success: false,
                error: 'INVALID_SUBTOTAL',
                message: 'Subtotal must be a positive number',
            });
        }

        // 1. Find coupon with usageLimit guard (mirror cart coupon query)
        console.log('[BuyNow][ValidateCoupon] Looking up coupon in DB...');
        const [rows] = await db.query(
            'SELECT * FROM coupons WHERE couponCode = ? AND (usageLimit IS NULL OR couponUsage < usageLimit)',
            [code]
        );

        if (!rows || rows.length === 0) {
            console.warn('[BuyNow][ValidateCoupon] No coupon found or usageLimit exceeded for code:', code);
            return res.status(200).json({
                success: false,
                error: 'INVALID_COUPON',
                message: 'Coupon not found or expired',
            });
        }

        const coupon = rows[0];
        console.log('[BuyNow][ValidateCoupon] Coupon row:', {
            couponID: coupon.couponID,
            couponCode: coupon.couponCode,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            usageLimit: coupon.usageLimit,
            couponUsage: coupon.couponUsage,
            assignedUser: coupon.assignedUser,
            minOrderValue: coupon.minOrderValue,
        });

        // 2. Minimum order value (if configured) – based on passed subtotal
        const minOrder = coupon.minOrderValue != null ? Number(coupon.minOrderValue) : null;
        if (minOrder != null && minOrder > 0 && subtotal < minOrder) {
            console.warn('[BuyNow][ValidateCoupon] Min order not met:', {
                minOrder,
                subtotal,
            });
            return res.status(200).json({
                success: false,
                error: 'MIN_ORDER_NOT_MET',
                message: `Minimum order value of ₹${minOrder} required for this coupon`,
            });
        }

        // 4. Calculate discount
        let couponDiscount = 0;
        if (coupon.discountType === 'percentage') {
            couponDiscount = subtotal * (Number(coupon.discountValue) / 100);
        } else if (coupon.discountType === 'flat') {
            couponDiscount = Number(coupon.discountValue || 0);
        }

        if (couponDiscount > subtotal) couponDiscount = subtotal;
        couponDiscount = Math.round(couponDiscount * 100) / 100;

        console.log('[BuyNow][ValidateCoupon] Computed discount:', {
            subtotal,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            couponDiscount,
            finalTotal: subtotal - couponDiscount,
        });

        return res.status(200).json({
            success: true,
            couponCode: coupon.couponCode,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            couponDiscount,
            message: `Coupon applied! You save ₹${couponDiscount}`,
        });
    } catch (err) {
        console.error('[BuyNow][ValidateCoupon] Error:', err);
        return res.status(500).json({
            success: false,
            error: 'COUPON_VALIDATION_FAILED',
            message: err.message || 'Failed to validate coupon',
        });
    }
};

/**
 * Main Buy Now controller
 * POST /api/order/buy-now
 */
const buyNowController = async (req, res) => {
    const payload = req.body || {};

    const {
        productType,
        productID,
        quantity = 1,
        variationID,
        selectedItems = [],
        customInputs = {},
        couponCode,
        paymentMode: rawPaymentMode,
        guestDetails,
        address: addressPayload,
        existingAddressID,
        uid: providedUid,
        selectedDressType,
    } = payload;

    const paymentMode = String(rawPaymentMode || 'COD').toUpperCase() === 'PREPAID' ? 'PREPAID' : 'COD';

    // Pre-generate merchant transaction ID for PREPAID flows so it can be stored
    // directly in order/presale records.
    let merchantOrderId = null;
    if (paymentMode === 'PREPAID') {
        merchantOrderId = randomUUID();
    }

    // High-level entry log for Buy Now
    console.log('[BuyNow] Incoming request body:', {
        productType,
        productID,
        quantity,
        variationID,
        hasSelectedItems: Array.isArray(selectedItems) && selectedItems.length > 0,
        hasCustomInputs: customInputs && Object.keys(customInputs || {}).length > 0,
        couponCode,
        paymentMode,
        hasGuestDetails: !!guestDetails,
        hasAddressPayload: !!addressPayload,
        existingAddressID,
        providedUid,
    });

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // STEP 1 — Resolve user
        // NOTE: This route is currently public (no auth middleware on the router),
        // so we primarily rely on uid provided in the body or guest details.
        // If auth middleware is later added, prefer req.user.uid when available.
        let uid = (req.user && req.user.uid) ? req.user.uid : (providedUid || null);
        let isNewUser = false;
        let userRow = null;

        const isGuest = !uid;

        console.log('[BuyNow][UserResolution] Start', {
            reqUserUid: req.user?.uid,
            providedUid,
            initialUid: uid,
            isGuest,
            hasExistingAddressID: !!existingAddressID,
            guestEmail: guestDetails?.email,
            guestPhone: guestDetails?.phone,
        });

        if (!isGuest) {
            const [rows] = await connection.query('SELECT * FROM users WHERE uid = ? LIMIT 1', [uid]);
            if (!rows || rows.length === 0) {
                console.error('[BuyNow][UserResolution] USER_NOT_FOUND for uid:', uid);
                return res
                    .status(400)
                    .json({ success: false, error: 'USER_NOT_FOUND', message: 'User not found for provided uid' });
            }
            userRow = rows[0];
        } else {
            // Try to infer user from existingAddressID first (logged-in user using a saved address
            // but not explicitly passing uid in the request body).
            if (existingAddressID) {
                const [addrOnlyRows] = await connection.query(
                    'SELECT * FROM address WHERE addressID = ? LIMIT 1',
                    [existingAddressID]
                );
                if (addrOnlyRows && addrOnlyRows.length > 0 && addrOnlyRows[0].uid) {
                    const addrUid = addrOnlyRows[0].uid;
                    const [addrUserRows] = await connection.query(
                        'SELECT * FROM users WHERE uid = ? LIMIT 1',
                        [addrUid]
                    );
                    if (addrUserRows && addrUserRows.length > 0) {
                        uid = addrUid;
                        userRow = addrUserRows[0];
                        isNewUser = false;
                        console.log('[BuyNow][UserResolution] Inferred user from existingAddressID:', {
                            existingAddressID,
                            inferredUid: uid,
                        });
                    }
                }
            }

            // If we still don't have a uid after trying existingAddressID, fall back to true guest flow.
            if (!uid) {
                const email = guestDetails?.email || addressPayload?.emailID || null;
                const phone = guestDetails?.phone || addressPayload?.phoneNumber || null;

                if (!email && !phone) {
                    await connection.rollback();
                    console.warn('[BuyNow][UserResolution] Missing guest details (email/phone) for true guest flow');
                    return res.status(400).json({
                        success: false,
                        error: 'GUEST_DETAILS_REQUIRED',
                        message: 'Guest email or phone is required',
                    });
                }

                const [existing] = await connection.query(
                    'SELECT * FROM users WHERE emailID = ? OR phonenumber = ? LIMIT 1',
                    [email, phone]
                );

                if (existing && existing.length > 0) {
                    userRow = existing[0];
                    uid = userRow.uid;
                    isNewUser = false;
                } else {
                    // Create new user
                    const newUid = generateUid();
                    const username = generateUsername(email || phone || 'user');

                    const rawPassword = generateRandomString(16, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
                    const hashed = await argon2.hash(rawPassword);

                    const name = guestDetails?.name || username;

                    await connection.query(
                        `INSERT INTO users (uid, username, emailID, phonenumber, name, password, balance, role, verifiedEmail, verifiedPhone, joinedOn, createdOn)
                         VALUES (?, ?, ?, ?, ?, ?, 0, 'user', 0, 0, NOW(), NOW())`,
                        [newUid, username, email, phone, name, hashed]
                    );

                    await coinModel.ensureBalanceRow(newUid);

                    uid = newUid;
                    isNewUser = true;

                    const [createdUserRows] = await connection.query('SELECT * FROM users WHERE uid = ? LIMIT 1', [uid]);
                    userRow = createdUserRows && createdUserRows[0] ? createdUserRows[0] : null;
                }
            }
        }

        if (!uid) {
            await connection.rollback();
            return res.status(500).json({
                success: false,
                error: 'USER_CREATION_FAILED',
                message: 'Failed to resolve user for Buy Now',
            });
        }

        // STEP 2 — Resolve address and shipping snapshot
        const { resolveShippingAddress } = require('../utils/resolveShippingAddress');
        let addressID = null;
        let shippingSnapshot = null;

        try {
            shippingSnapshot = await resolveShippingAddress({
                existingAddressID,
                addressBody: addressPayload || null,
                uid,
                connection,
            });
            addressID = shippingSnapshot.addressID;
        } catch (addrErr) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: 'INVALID_ADDRESS',
                message: addrErr.message || 'Address information is required for Buy Now',
            });
        }

        // STEP 3 — Fetch product(s) and validate stock
        const qty = Math.max(1, Number(quantity) || 1);

        let productRow = null;
        let variationRow = null;
        let presaleProductRow = null;
        let presaleVariationRow = null;
        let comboItemsDefinition = [];

        const now = new Date();

        if (productType === 'variable' || productType === 'customproduct' || productType === 'combo' || productType === 'make_combo') {
            // Base product
            const [prodRows] = await connection.query('SELECT * FROM products WHERE productID = ? LIMIT 1', [productID]);
            if (!prodRows || prodRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    error: 'PRODUCT_NOT_FOUND',
                    message: 'Product not found',
                });
            }
            productRow = prodRows[0];
        }

        if (productType === 'variable') {
            if (!variationID) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'MISSING_VARIATION',
                    message: 'variationID is required for variable products',
                });
            }
            const [varRows] = await connection.query(
                'SELECT * FROM variations WHERE variationID = ? AND productID = ? LIMIT 1',
                [variationID, productID]
            );
            if (!varRows || varRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    error: 'VARIATION_NOT_FOUND',
                    message: 'Variation not found for this product',
                });
            }
            variationRow = varRows[0];
            if (Number(variationRow.variationStock || 0) < qty) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'OUT_OF_STOCK',
                    message: 'Requested quantity exceeds available stock',
                });
            }
        } else if (productType === 'combo') {
            // Static combo – productID doubles as comboID
            const comboID = productID;
            const [comboRows] = await connection.query('SELECT * FROM combo_item WHERE comboID = ?', [comboID]);
            comboItemsDefinition = comboRows || [];
            // Validate stock for any children that have variations
            for (const item of comboItemsDefinition) {
                // Combos here are defined at product level; variation-level stock
                // is validated using selected variationIDs if present in request.
                // Current schema does not define variationID on combo_item, so we
                // assume parent product manages its own stock or is unlimited.
                // If you later add variationID to combo_item, extend this check.
                // No-op for now.
            }
        } else if (productType === 'make_combo') {
            // Validate selected items against make_combo_items
            const comboID = productID;
            const [allowedRows] = await connection.query('SELECT * FROM make_combo_items WHERE comboID = ?', [comboID]);
            const allowed = allowedRows || [];

            for (const sel of selectedItems) {
                const allowedMatch = allowed.find(
                    (row) =>
                        row.productID === sel.productID &&
                        (row.variationID == null || row.variationID === sel.variationID)
                );
                if (!allowedMatch) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'INVALID_MAKE_COMBO_SELECTION',
                        message: 'One or more selected items are not allowed for this make_combo',
                    });
                }

                if (sel.variationID) {
                    const [varRows] = await connection.query(
                        'SELECT * FROM variations WHERE variationID = ? AND productID = ? LIMIT 1',
                        [sel.variationID, sel.productID]
                    );
                    if (!varRows || varRows.length === 0) {
                        await connection.rollback();
                        return res.status(404).json({
                            success: false,
                            error: 'VARIATION_NOT_FOUND',
                            message: 'Variation not found for make combo item',
                        });
                    }
                    const v = varRows[0];
                    if (Number(v.variationStock || 0) < 1) {
                        await connection.rollback();
                        return res.status(400).json({
                            success: false,
                            error: 'OUT_OF_STOCK',
                            message: 'One or more make_combo items are out of stock',
                        });
                    }
                }
            }
        } else if (productType === 'customproduct') {
            // Validate required custom inputs
            let template = null;
            if (productRow && productRow.custom_inputs) {
                try {
                    let parsed = productRow.custom_inputs;
                    while (typeof parsed === 'string') parsed = JSON.parse(parsed);
                    template = parsed;
                } catch {
                    template = null;
                }
            }
            if (Array.isArray(template) && template.length > 0) {
                const missing = [];
                for (const field of template) {
                    if (field.required) {
                        const val = customInputs[field.id];
                        if (val === undefined || val === null || String(val).trim() === '') {
                            missing.push(field.label || field.id);
                        }
                    }
                }
                if (missing.length > 0) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'MISSING_CUSTOM_INPUTS',
                        message: 'Required custom fields are missing',
                        details: missing,
                    });
                }
            }

            // [NEW] Validate and Inject Dress Type
            let matchedDressType = null;
            if (selectedDressType) {
                let availableDressTypes = [];
                try {
                    let dt = productRow.dressTypes;
                    while (typeof dt === 'string') dt = JSON.parse(dt);
                    availableDressTypes = Array.isArray(dt) ? dt : [];
                } catch (e) {
                    availableDressTypes = [];
                }

                const matchedType = availableDressTypes.find(t => t.label === (selectedDressType.label || selectedDressType));
                if (!matchedType) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'INVALID_DRESS_TYPE',
                        message: 'Selected dress type is not available for this product',
                    });
                }
                
                matchedDressType = matchedType;
                
                // Inject into customInputs for persistence
                if (!customInputs || typeof customInputs !== 'object') customInputs = {};
                customInputs['Dress Type'] = matchedType.label;
            }

            if (variationID) {
                const [varRows] = await connection.query(
                    'SELECT * FROM variations WHERE variationID = ? AND productID = ? LIMIT 1',
                    [variationID, productID]
                );
                if (!varRows || varRows.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({
                        success: false,
                        error: 'VARIATION_NOT_FOUND',
                        message: 'Variation not found for this custom product',
                    });
                }
                variationRow = varRows[0];
                if (Number(variationRow.variationStock || 0) < qty) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'OUT_OF_STOCK',
                        message: 'Requested quantity exceeds available stock',
                    });
                }
            }
        } else if (productType === 'presale') {
            // Presale flow uses separate tables
            const [ppRows] = await connection.query(
                'SELECT * FROM presale_products WHERE presaleProductID = ? LIMIT 1',
                [productID]
            );
            if (!ppRows || ppRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    error: 'PRODUCT_NOT_FOUND',
                    message: 'Presale product not found',
                });
            }
            presaleProductRow = ppRows[0];

            if (presaleProductRow.status !== 'active') {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'PRESALE_NOT_ACTIVE',
                    message: 'Presale is not active',
                });
            }

            const start = presaleProductRow.preSaleStartDate ? new Date(presaleProductRow.preSaleStartDate) : null;
            const end = presaleProductRow.preSaleEndDate ? new Date(presaleProductRow.preSaleEndDate) : null;
            if ((start && now < start) || (end && now > end)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'PRESALE_NOT_ACTIVE',
                    message: 'Presale is not in valid date range',
                });
            }

            const totalAvailable = Number(presaleProductRow.totalAvailableQuantity || 0);
            const reserved = Number(presaleProductRow.reservedQuantity || 0);
            if (totalAvailable && totalAvailable - reserved < qty) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'PRESALE_QUOTA_EXCEEDED',
                    message: 'No available presale slots',
                });
            }

            if (variationID) {
                const [varRows] = await connection.query(
                    'SELECT * FROM variations WHERE variationID = ? AND productID = ? LIMIT 1',
                    [variationID, productID]
                );
                if (!varRows || varRows.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({
                        success: false,
                        error: 'VARIATION_NOT_FOUND',
                        message: 'Variation not found for presale product',
                    });
                }
                presaleVariationRow = varRows[0];
                if (Number(presaleVariationRow.variationStock || 0) < qty) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'OUT_OF_STOCK',
                        message: 'Requested quantity exceeds available presale stock',
                    });
                }
            }
        } else {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: 'INVALID_PRODUCT_TYPE',
                message: 'Unsupported productType for Buy Now',
            });
        }

        // STEP 4 — Calculate pricing (single-line focus)
        let unitPriceBefore = 0;
        let regularPrice = 0;
        let salePrice = null;

        if (productType === 'variable' || (productType === 'customproduct' && variationRow)) {
            const baseRegular = Number(variationRow.variationPrice || 0);
            const baseSale =
                variationRow.variationSalePrice != null ? Number(variationRow.variationSalePrice) : null;
            regularPrice = baseRegular;
            unitPriceBefore = baseSale != null ? baseSale : baseRegular;
            salePrice = baseSale;
        } else if (productType === 'presale') {
            const baseRegular = Number(presaleProductRow.regularPrice || 0);
            const baseSale = presaleProductRow.salePrice != null ? Number(presaleProductRow.salePrice) : null;
            regularPrice = baseRegular;
            unitPriceBefore = baseSale != null ? baseSale : baseRegular;
            salePrice = baseSale;
        } else {
            const baseRegular = Number(productRow.regularPrice || 0);
            const baseSale = productRow.salePrice != null ? Number(productRow.salePrice) : null;
            regularPrice = baseRegular;
            unitPriceBefore = baseSale != null ? baseSale : baseRegular;
            salePrice = baseSale;
        }

        // [NEW] Apply Dress Type override for custom products (overrides variation/product prices)
        if (productType === 'customproduct' && matchedDressType) {
            regularPrice = Number(matchedDressType.price);
            unitPriceBefore = regularPrice;
            salePrice = null; // Dress type price overrides any sale price
        }

        let isFlashSale = 0;
        let offerID = null;
        let offerApplied = 0;
        let offerStatus = 'none';

        // Flash sale (same as cart recompute)
        if (productType !== 'presale') {
            const [fsRows] = await connection.query(
                `SELECT fsi.*
                 FROM flash_sale_items fsi
                 JOIN flash_sale_details fsd ON fsi.saleID = fsd.saleID
                 WHERE fsi.productID = ?
                   AND fsd.status = 'active'
                   AND NOW() BETWEEN fsd.startTime AND fsd.endTime
                 LIMIT 1`,
                [productID]
            );
            if (fsRows && fsRows.length > 0) {
                const fs = fsRows[0];
                if (fs.discountType === 'percentage') {
                    unitPriceBefore = Number(
                        (unitPriceBefore * (100 - Number(fs.discountValue || 0)) / 100).toFixed(2)
                    );
                } else if (fs.discountType === 'fixed') {
                    unitPriceBefore = Math.max(
                        0,
                        Number((unitPriceBefore - Number(fs.discountValue || 0)).toFixed(2))
                    );
                }
                isFlashSale = 1;
            }
        }

        let unitPriceAfter = unitPriceBefore;
        let lineTotalBefore = Number((regularPrice * qty).toFixed(2));
        let lineTotalAfter = Number((unitPriceAfter * qty).toFixed(2));

        // Offer application (strictly for variable products as per user request)
        if (productType === 'variable') {
            const [offerRows] = await connection.query(
                'SELECT * FROM offers WHERE JSON_CONTAINS(products, JSON_QUOTE(?)) LIMIT 1',
                [productID]
            );

            if (offerRows && offerRows.length > 0) {
                const offer = offerRows[0];
                offerID = offer.offerID;

                const offerType = offer.offerType;
                const buyCount = Number(offer.buyCount || 0);
                const getCount = Number(offer.getCount || 0);
                const buyAt = offer.buyAt != null ? Number(offer.buyAt) : null;

                if (offerType === 'buy_x_get_y' && buyCount > 0 && getCount > 0) {
                    const groupSize = buyCount + getCount;
                    const totalQty = qty;
                    const numGroups = Math.floor(totalQty / groupSize);

                    if (numGroups > 0) {
                        const freeUnits = numGroups * getCount;
                        const paidUnits = totalQty - freeUnits;
                        const paidUnitsSafe = Math.max(paidUnits, 0);

                        const base = unitPriceBefore;
                        const paidTotal = base * paidUnitsSafe;

                        unitPriceAfter = Number((paidTotal / totalQty).toFixed(2));
                        lineTotalAfter = Number(paidTotal.toFixed(2));

                        offerApplied = 1;
                        offerStatus = 'applied';
                    } else {
                        // Offer exists but quantity not enough
                        offerApplied = 0;
                        offerStatus = 'missing';
                        unitPriceAfter = unitPriceBefore;
                        lineTotalAfter = Number((unitPriceAfter * qty).toFixed(2));
                    }
                } else if (offerType === 'buy_x_at_x' && buyCount > 0 && buyAt != null) {
                    const totalQty = qty;
                    const numGroups = Math.floor(totalQty / buyCount);
                    const eligibleQty = numGroups * buyCount;

                    if (eligibleQty > 0) {
                        const base = unitPriceBefore;
                        const basePaise = Math.round(base * 100);
                        const bundlePricePaise = Math.round(buyAt * 100);

                        const discBase = Math.floor(bundlePricePaise / buyCount);
                        const remainder = bundlePricePaise % buyCount;

                        let qtyLeftEligible = eligibleQty;
                        let remainderCount = remainder * numGroups;

                        const unitArray = [];
                        for (let i = 0; i < totalQty; i++) {
                            if (qtyLeftEligible > 0) {
                                let pricePaise = discBase;
                                if (remainderCount > 0) {
                                    pricePaise += 1;
                                    remainderCount--;
                                }
                                unitArray.push(pricePaise / 100);
                                qtyLeftEligible--;
                            } else {
                                unitArray.push(basePaise / 100);
                            }
                        }

                        const totalCents = unitArray.reduce((a, b) => a + Math.round(b * 100), 0);
                        unitPriceAfter = Number((totalCents / (totalQty * 100)).toFixed(2));
                        lineTotalAfter = Number((unitArray.reduce((a, b) => a + b, 0)).toFixed(2));

                        offerApplied = 1;
                        offerStatus = 'applied';
                    } else {
                        offerApplied = 0;
                        offerStatus = 'missing';
                        unitPriceAfter = unitPriceBefore;
                        lineTotalAfter = Number((unitPriceAfter * qty).toFixed(2));
                    }
                } else {
                    // Offer row exists but unsupported configuration
                    offerApplied = 0;
                    offerStatus = 'missing';
                    unitPriceAfter = unitPriceBefore;
                    lineTotalAfter = Number((unitPriceAfter * qty).toFixed(2));
                }
            }
        }

        let subtotal = lineTotalAfter;
        let couponDiscount = 0;

        if (couponCode) {
            const [couponRows] = await connection.query(
                'SELECT * FROM coupons WHERE couponCode = ? LIMIT 1',
                [couponCode]
            );
            if (!couponRows || couponRows.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_COUPON',
                    message: 'Coupon not found',
                });
            }
            const coupon = couponRows[0];

            if (coupon.usageLimit != null && Number(coupon.couponUsage || 0) >= Number(coupon.usageLimit)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_COUPON',
                    message: 'Coupon usage limit exceeded',
                });
            }

            // assignedUser is an email or admin; ignore if set to admin address
            if (coupon.assignedUser && coupon.assignedUser !== 'admin@ithyaraa.com') {
                const email = userRow?.emailID || guestDetails?.email || addressPayload?.emailID;
                if (!email || email !== coupon.assignedUser) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'INVALID_COUPON',
                        message: 'Coupon not assigned to this user',
                    });
                }
            }

            if (coupon.discountType === 'percentage') {
                couponDiscount = Number((subtotal * Number(coupon.discountValue || 0) / 100).toFixed(2));
            } else if (coupon.discountType === 'flat') {
                couponDiscount = Number(coupon.discountValue || 0);
            }

            if (couponDiscount < 0) couponDiscount = 0;
            if (couponDiscount > subtotal) couponDiscount = subtotal;

            await connection.query(
                'UPDATE coupons SET couponUsage = couponUsage + 1 WHERE couponID = ?',
                [coupon.couponID]
            );
        }

        const handlingFee = paymentMode === 'COD' ? 8 : 0;
        const total = Number((subtotal - couponDiscount + handlingFee).toFixed(2));
        const totalDiscount = Number((lineTotalBefore * 1 - lineTotalAfter * 1 + couponDiscount).toFixed(2));

        // Coins
        const coinsEarned = total > 0 ? Math.floor(total / 100) : 0;

        // STEP 5 — IDs
        const txnID = randomUUID();
        const comboInstanceID =
            productType === 'combo' || productType === 'make_combo' ? generateComboInstanceId() : null;

        // STEP 6 — Insert order / presale records
        let orderID = null;
        let preBookingID = null;

        if (productType === 'presale') {
            // Inline presale_booking_details insert
            const deliveryPhone =
                addressPayload?.phoneNumber || guestDetails?.phone || userRow?.phonenumber || null;
            const deliveryEmail = addressPayload?.emailID || guestDetails?.email || userRow?.emailID || null;

            const [detailResult] = await connection.query(
                `INSERT INTO presale_booking_details (
                    uid, addressLine1, addressLine2, pincode, landmark, state, city, phoneNumber,
                    subtotal, total, discount, deliveryCompany, trackingCode,
                    paymentStatus, orderStatus, status, txnID, merchantID,
                    isWalletUsed, paidWallet, coinsEarned, paymentType, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'pending', 'pending', 'pending', ?, ?, 0, 0.00, ?, ?, NOW())`,
                [
                    uid,
                    addressPayload.line1 || '',
                    addressPayload.line2 || '',
                    addressPayload.pincode || '',
                    addressPayload.landmark || '',
                    addressPayload.state || '',
                    addressPayload.city || '',
                    deliveryPhone,
                    subtotal,
                    total,
                    couponDiscount,
                    txnID,
                    paymentMode === 'PREPAID' ? merchantOrderId : null,
                    coinsEarned,
                    paymentMode,
                ]
            );

            preBookingID = detailResult.insertId;

            const variationName = presaleVariationRow ? presaleVariationRow.variationName : null;
            const variationSlug = presaleVariationRow ? presaleVariationRow.variationSlug : null;

            await connection.query(
                `INSERT INTO presale_booking_items (
                    preBookingID, productID, name, variationID, variationSlug, variationName,
                    salePrice, regularPrice, unitPrice, unitSalePrice, featuredImage, referBy, brandID, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NOW())`,
                [
                    preBookingID,
                    productID,
                    presaleProductRow.name,
                    variationID || null,
                    variationSlug || null,
                    variationName || null,
                    salePrice != null ? salePrice : regularPrice,
                    regularPrice,
                    regularPrice,
                    salePrice != null ? salePrice : regularPrice,
                    presaleProductRow.featuredImage || '[]',
                ]
            );
        } else {
            // Normal orderDetail + order_items
            const pm = paymentMode;
            const paymentStatus = pm === 'PREPAID' ? 'pending' : 'successful';

            // Handle handling fee for COD
            // handlingFee is already defined at higher scope for normal orders
            const handFeeRate = 0;

            const [detailResult] = await connection.query(
                `INSERT INTO orderDetail (
                    uid, subtotal, total, totalDiscount, modified, txnID, createdAt,
                    addressID,
                    shippingName, shippingPhone, shippingEmail,
                    shippingLine1, shippingLine2, shippingCity, shippingState, shippingPincode, shippingLandmark,
                    paymentMode, paymentStatus, trackingID, deliveryCompany, merchantID,
                    couponCode, couponDiscount, referBy, isWalletUsed, paidWallet, handlingFee, handFeeRate, isBuyNow
                ) VALUES (?, ?, ?, ?, 0, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    uid,
                    subtotal,
                    total,
                    totalDiscount,
                    txnID,
                    addressID,
                    shippingSnapshot.shippingName || null,
                    shippingSnapshot.shippingPhone || null,
                    shippingSnapshot.shippingEmail || null,
                    shippingSnapshot.shippingLine1 || null,
                    shippingSnapshot.shippingLine2 || null,
                    shippingSnapshot.shippingCity || null,
                    shippingSnapshot.shippingState || null,
                    shippingSnapshot.shippingPincode || null,
                    shippingSnapshot.shippingLandmark || null,
                    pm,
                    paymentStatus,
                    null, // trackingID
                    null, // deliveryCompany
                    pm === 'PREPAID' ? merchantOrderId : null,
                    couponCode || null,
                    couponDiscount,
                    null, // referBy (Buy Now has no affiliate referBy today)
                    0,    // isWalletUsed
                    0.00, // paidWallet
                    handlingFee,
                    handFeeRate,
                    1 // isBuyNow
                ]
            );

            orderID = detailResult.insertId;

            const baseName = productRow?.name || presaleProductRow?.name || 'Product';
            const variationName = variationRow?.variationName || null;
            const featuredImage = productRow?.featuredImage || '[]';
            const brandID = productRow?.brandID || 'inhouse';

            await connection.query(
                `INSERT INTO order_items (
                    orderID, uid, productID, quantity,
                    variationID, variationName,
                    overridePrice, salePrice, regularPrice,
                    unitPriceBefore, unitPriceAfter,
                    lineTotalBefore, lineTotalAfter,
                    offerID, offerApplied, offerStatus, appliedOfferID,
                    name, featuredImage, comboID, brandID, referBy, custom_inputs, earnedCoins, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    orderID,
                    uid,
                    productID,
                    qty,
                    variationID || null,
                    variationName || null,
                    null, // overridePrice
                    salePrice != null ? salePrice : regularPrice,
                    regularPrice,
                    unitPriceBefore,
                    unitPriceAfter,
                    lineTotalBefore,
                    lineTotalAfter,
                    offerID || null,
                    offerApplied || 0,
                    offerStatus || 'none',
                    null, // appliedOfferID
                    baseName,
                    featuredImage,
                    comboInstanceID || null,
                    brandID,
                    '', // referBy
                    productType === 'customproduct' ? JSON.stringify(customInputs || {}) : null,
                    coinsEarned,
                ]
            );

            // Combo/make_combo breakdown in order_combo_items
            if (productType === 'combo') {
                for (const item of comboItemsDefinition) {
                    await connection.query(
                        `INSERT INTO order_combo_items (
                            comboID, productID, variationID, productName,
                            featuredImage, variationName, createdAt, updatedAt, quantity
                        ) VALUES (?, ?, NULL, ?, ?, NULL, NOW(), NOW(), ?)`,
                        [
                            comboInstanceID,
                            item.productID,
                            item.productName,
                            item.featuredImage,
                            1,
                        ]
                    );
                }
            } else if (productType === 'make_combo') {
                for (const sel of selectedItems) {
                    // Fetch product/variation names for breakdown only
                    const [childProdRows] = await connection.query(
                        'SELECT name, featuredImage FROM products WHERE productID = ? LIMIT 1',
                        [sel.productID]
                    );
                    const childProd = childProdRows && childProdRows[0] ? childProdRows[0] : null;
                    let variationNameChild = null;
                    if (sel.variationID) {
                        const [childVarRows] = await connection.query(
                            'SELECT variationName FROM variations WHERE variationID = ? AND productID = ? LIMIT 1',
                            [sel.variationID, sel.productID]
                        );
                        variationNameChild =
                            childVarRows && childVarRows[0] ? childVarRows[0].variationName : null;
                    }
                    await connection.query(
                        `INSERT INTO order_combo_items (
                            comboID, productID, variationID, productName,
                            featuredImage, variationName, createdAt, updatedAt, quantity
                        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), 1)`,
                        [
                            comboInstanceID,
                            sel.productID,
                            sel.variationID || null,
                            childProd?.name || 'Product',
                            childProd?.featuredImage || '[]',
                            variationNameChild,
                        ]
                    );
                }
            }
        }

        // STEP 7 — Decrement stock / increment presale reserved
        if (productType === 'variable') {
            const [result] = await connection.query(
                'UPDATE variations SET variationStock = variationStock - ? WHERE variationID = ? AND variationStock >= ?',
                [qty, variationID, qty]
            );
            if (!result.affectedRows) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'OUT_OF_STOCK',
                    message: 'Stock changed while placing order',
                });
            }
        } else if (productType === 'customproduct' && variationID) {
            const [result] = await connection.query(
                'UPDATE variations SET variationStock = variationStock - ? WHERE variationID = ? AND variationStock >= ?',
                [qty, variationID, qty]
            );
            if (!result.affectedRows) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'OUT_OF_STOCK',
                    message: 'Stock changed while placing order',
                });
            }
        } else if (productType === 'make_combo') {
            for (const sel of selectedItems) {
                if (!sel.variationID) continue;
                const [result] = await connection.query(
                    'UPDATE variations SET variationStock = variationStock - 1 WHERE variationID = ? AND variationStock >= 1',
                    [sel.variationID]
                );
                if (!result.affectedRows) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'OUT_OF_STOCK',
                        message: 'Stock changed for one of the make_combo items',
                    });
                }
            }
        } else if (productType === 'presale') {
            const [res1] = await connection.query(
                'UPDATE presale_products SET reservedQuantity = reservedQuantity + ? WHERE presaleProductID = ? AND (totalAvailableQuantity - reservedQuantity) >= ?',
                [qty, productID, qty]
            );
            if (!res1.affectedRows) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'PRESALE_QUOTA_EXCEEDED',
                    message: 'No available presale slots',
                });
            }
            if (variationID) {
                const [res2] = await connection.query(
                    'UPDATE variations SET variationStock = variationStock - ? WHERE variationID = ? AND variationStock >= ?',
                    [qty, variationID, qty]
                );
                if (!res2.affectedRows) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        error: 'OUT_OF_STOCK',
                        message: 'Presale variation stock changed while placing order',
                    });
                }
            }
        }

        // STEP 8 — Coins (mirror normal order flow: pending at creation, completed on delivery)
        try {
            if (coinsEarned > 0) {
                if (productType === 'presale') {
                    // Use 'presale' refType for presale bookings
                    await coinModel.createPendingCoins(uid, preBookingID, coinsEarned, 'presale');
                    await connection.query(
                        'UPDATE presale_booking_details SET coinsEarned = ? WHERE preBookingID = ?',
                        [coinsEarned, preBookingID]
                    );
                } else {
                    await coinModel.createPendingCoins(uid, orderID, coinsEarned);
                    await connection.query(
                        'UPDATE orderDetail SET coinsEarned = ? WHERE orderID = ?',
                        [coinsEarned, orderID]
                    );
                }
            }
        } catch (coinErr) {
            console.error('[BuyNow] Failed to create pending coins:', coinErr);
            // Non-blocking – do not fail order placement because of coin error
        }

        // STEP 9 — Access token for new users
        let sessionToken = null;
        if (isNewUser && userRow) {
            const accessPayload = {
                uid: uid,
                username: userRow.username,
                emailID: userRow.emailID,
                role: userRow.role || 'user',
            };
            sessionToken = generateAccessToken(accessPayload);
        }

        // STEP 10 — Commit transaction (all DB work done, no external calls inside)
        await connection.commit();

        // STEP 11 — PhonePe initiation for PREPAID (outside transaction)
        let phonePeRedirectURL = null;

        if (paymentMode === 'PREPAID') {
            const amountRupees = Number(total || 0);
            const amountPaise = Math.round((isNaN(amountRupees) ? 0 : amountRupees) * 100);

            if (!amountPaise || amountPaise <= 0) {
                return res.status(200).json({
                    success: true,
                    orderID,
                    preBookingID,
                    txnID,
                    uid,
                    isNewUser,
                    sessionToken: sessionToken || null,
                    paymentMode,
                    paymentStatus: 'pending',
                    phonePeRedirectURL: null,
                    phonePeError: 'INVALID_AMOUNT',
                    redirectURL:
                        productType === 'presale'
                            ? preBookingID != null
                                ? `/presale/order-status/${preBookingID}`
                                : null
                            : orderID != null
                                ? `/order-status/order-summary/${orderID}`
                                : null,
                });
            }

            const frontendUrlBase = (process.env.FRONTEND_URL || 'http://localhost:7885').replace(/\/+$/, '');
            const backendUrl = (process.env.BACKEND_URL || 'http://localhost:7885').replace(/\/+$/, '');

            let redirectUrl;
            let callbackUrl;

            if (productType === 'presale') {
                redirectUrl = `${frontendUrlBase}/presale/order-status/${preBookingID}`.replace(
                    /([^:]\/)\/+/g,
                    '$1'
                );
                callbackUrl = `${backendUrl}/api/phonepe/webhook/presale`;
            } else {
                redirectUrl = `${frontendUrlBase}/order-status/order-summary/${orderID}`.replace(
                    /([^:]\/)\/+/g,
                    '$1'
                );
                callbackUrl = `${backendUrl}/api/phonepe/webhook/order`;
            }

            const payloadObj = {
                merchantId,
                merchantTransactionId: merchantOrderId,
                amount: amountPaise,
                redirectUrl,
                callbackUrl,
                redirectMode: 'REDIRECT',
                paymentInstrument: { type: 'PAY_PAGE' },
            };

            const base64Payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
            const checksum = generateChecksum(base64Payload);

            const fetch = require('node-fetch');
            // Use global AbortController if available (Node 18+), otherwise skip timeout signal.
            const AbortCtrl = global.AbortController || global.abortController || null;
            const controller = AbortCtrl ? new AbortCtrl() : null;
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            let phonePeResponse;
            try {
                const response = await fetch(phonePeUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-VERIFY': checksum,
                        'X-MERCHANT-ID': merchantId,
                    },
                    body: JSON.stringify({ request: base64Payload }),
                    signal: controller ? controller.signal : undefined,
                });
                phonePeResponse = await response.json();
            } catch (fetchErr) {
                clearTimeout(timeoutId);
                console.error('[BuyNow][PhonePe] Fetch failed after order committed:', fetchErr.message);
                return res.status(200).json({
                    success: true,
                    orderID,
                    preBookingID,
                    txnID,
                    uid,
                    isNewUser,
                    sessionToken: sessionToken || null,
                    paymentMode,
                    paymentStatus: 'pending',
                    phonePeRedirectURL: null,
                    phonePeError: 'PAYMENT_INIT_FAILED',
                    redirectURL:
                        productType === 'presale'
                            ? preBookingID != null
                                ? `/presale/order-status/${preBookingID}`
                                : null
                            : orderID != null
                                ? `/order-status/order-summary/${orderID}`
                                : null,
                });
            }
            clearTimeout(timeoutId);

            if (!phonePeResponse?.success) {
                console.error('[BuyNow][PhonePe] PhonePe returned failure:', phonePeResponse);
                return res.status(200).json({
                    success: true,
                    orderID,
                    preBookingID,
                    txnID,
                    uid,
                    isNewUser,
                    sessionToken: sessionToken || null,
                    paymentMode,
                    paymentStatus: 'pending',
                    phonePeRedirectURL: null,
                    phonePeError: 'PAYMENT_GATEWAY_FAILED',
                    redirectURL:
                        productType === 'presale'
                            ? preBookingID != null
                                ? `/presale/order-status/${preBookingID}`
                                : null
                            : orderID != null
                                ? `/order-status/order-summary/${orderID}`
                                : null,
                });
            }

            phonePeRedirectURL =
                phonePeResponse?.data?.instrumentResponse?.redirectInfo?.url ||
                phonePeResponse?.data?.redirectUrl ||
                null;
        }

        // FINAL RESPONSE
        return res.status(200).json({
            success: true,
            orderID: orderID,
            preBookingID,
            txnID,
            uid,
            isNewUser,
            sessionToken: sessionToken || null,
            paymentMode,
            paymentStatus: paymentMode === 'PREPAID' ? 'pending' : productType === 'presale' ? 'pending' : 'successful',
            phonePeRedirectURL,
            redirectURL:
                productType === 'presale'
                    ? preBookingID != null
                        ? `/presale/order-status/${preBookingID}`
                        : null
                    : orderID != null
                        ? `/order-status/order-summary/${orderID}`
                        : null,
        });
    } catch (err) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackErr) {
                console.error('Rollback error in Buy Now controller:', rollbackErr);
            }
        }
        console.error('Buy Now error:', err);
        return res.status(500).json({
            success: false,
            error: 'ORDER_CREATION_FAILED',
            message: err.message || 'Failed to place order via Buy Now',
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

/**
 * Lightweight offer preview for Buy Now (no DB mutations).
 * GET /api/order/buy-now/check-offer?productID=...&quantity=...&productType=...
 */
const checkOffer = async (req, res) => {
    try {
        const productID = req.query.productID;
        const rawQuantity = req.query.quantity;
        const productType = req.query.productType || 'variable';
        const selectedDressType = req.query.selectedDressType;
        const variationID = req.query.variationID;

        const qty = Math.max(1, Number(rawQuantity) || 1);

        console.log('[BuyNow][CheckOffer] Incoming request:', {
            productID,
            rawQuantity,
            qty,
            productType,
            variationID,
        });

        if (!productID) {
            console.warn('[BuyNow][CheckOffer] Missing productID');
            return res.status(400).json({
                success: false,
                offerApplied: false,
                message: 'productID is required',
            });
        }

        if (productType !== 'variable') {
            console.log(`[BuyNow][CheckOffer] ${productType} product – skipping offer check`);
            return res.status(200).json({
                success: true,
                offerApplied: false,
                message: `Offers are only available for variable products`,
            });
        }

        // Fetch base product pricing
        const [prodRows] = await db.query('SELECT * FROM products WHERE productID = ? LIMIT 1', [productID]);
        if (!prodRows || prodRows.length === 0) {
            console.warn('[BuyNow][CheckOffer] Product not found for productID:', productID);
            return res.status(404).json({
                success: false,
                offerApplied: false,
                message: 'Product not found',
            });
        }
        const productRow = prodRows[0];

        let unitPriceBefore = productRow.salePrice != null
            ? Number(productRow.salePrice)
            : Number(productRow.regularPrice || 0);

        // [NEW] Handle variation price override for variable products
        if (variationID) {
            const [varRows] = await db.query(
                'SELECT * FROM variations WHERE variationID = ? AND productID = ? LIMIT 1',
                [variationID, productID]
            );
            if (varRows && varRows.length > 0) {
                const v = varRows[0];
                unitPriceBefore = v.variationSalePrice != null 
                    ? Number(v.variationSalePrice) 
                    : Number(v.variationPrice || 0);
            }
        }

        // Apply Dress Type price override for custom products
        if (productType === 'customproduct' && selectedDressType) {
            let availableDressTypes = [];
            try {
                let dt = productRow.dressTypes;
                while (typeof dt === 'string') dt = JSON.parse(dt);
                availableDressTypes = Array.isArray(dt) ? dt : [];
            } catch (e) {
                availableDressTypes = [];
            }

            const matchedType = availableDressTypes.find(t => t.label === (selectedDressType.label || selectedDressType));
            if (matchedType && matchedType.price) {
                unitPriceBefore = Number(matchedType.price);
            }
        }

        // Flash sale (for preview use same logic as buyNowController)
        const [fsRows] = await db.query(
            `SELECT fsi.*
             FROM flash_sale_items fsi
             JOIN flash_sale_details fsd ON fsi.saleID = fsd.saleID
             WHERE fsi.productID = ?
               AND fsd.status = 'active'
               AND NOW() BETWEEN fsd.startTime AND fsd.endTime
             LIMIT 1`,
            [productID]
        );
        if (fsRows && fsRows.length > 0) {
            const fs = fsRows[0];
            console.log('[BuyNow][CheckOffer] Flash sale row found:', {
                saleID: fs.saleID,
                discountType: fs.discountType,
                discountValue: fs.discountValue,
            });
            if (fs.discountType === 'percentage') {
                unitPriceBefore = Number(
                    (unitPriceBefore * (100 - Number(fs.discountValue || 0)) / 100).toFixed(2)
                );
            } else if (fs.discountType === 'fixed') {
                unitPriceBefore = Math.max(
                    0,
                    Number((unitPriceBefore - Number(fs.discountValue || 0)).toFixed(2))
                );
            }
        }

        const originalTotal = Number((unitPriceBefore * qty).toFixed(2));
        console.log('[BuyNow][CheckOffer] Base pricing after flash:', {
            unitPriceBefore,
            qty,
            originalTotal,
        });

        // Look up offer (same condition as main flow)
        const [offerRows] = await db.query(
            'SELECT * FROM offers WHERE JSON_CONTAINS(products, JSON_QUOTE(?)) LIMIT 1',
            [productID]
        );

        if (!offerRows || offerRows.length === 0) {
            console.log('[BuyNow][CheckOffer] No active offers found for productID:', productID);
            return res.status(200).json({
                success: true,
                offerApplied: false,
                originalTotal,
                discountedTotal: originalTotal,
                savedAmount: 0,
            });
        }

        const offer = offerRows[0];
        const offerName = offer.offerName || offer.offerID || 'Offer';
        const offerType = offer.offerType;
        const buyCount = Number(offer.buyCount || 0);
        const getCount = Number(offer.getCount || 0);
        const buyAt = offer.buyAt != null ? Number(offer.buyAt) : null;

        let offerApplied = false;
        let offerStatus = 'none';
        let freeUnits = 0;
        let paidUnits = qty;
        let discountedTotal = originalTotal;

        console.log('[BuyNow][CheckOffer] Offer found:', {
            offerID: offer.offerID,
            offerName,
            offerType,
            buyCount,
            getCount,
            buyAt,
        });

        if (offerType === 'buy_x_get_y' && buyCount > 0 && getCount > 0) {
            const groupSize = buyCount + getCount;
            const numGroups = Math.floor(qty / groupSize);

            if (numGroups > 0) {
                freeUnits = numGroups * getCount;
                paidUnits = qty - freeUnits;
                const paidTotal = unitPriceBefore * paidUnits;
                discountedTotal = Number(paidTotal.toFixed(2));
                offerApplied = true;
                offerStatus = 'applied';
                console.log('[BuyNow][CheckOffer] buy_x_get_y applied:', {
                    groupSize,
                    numGroups,
                    freeUnits,
                    paidUnits,
                    originalTotal,
                    discountedTotal,
                });
            } else {
                offerApplied = false;
                offerStatus = 'missing';
                console.log('[BuyNow][CheckOffer] buy_x_get_y present but qty not sufficient:', {
                    groupSize,
                    qty,
                });
            }
        } else if (offerType === 'buy_x_at_x' && buyCount > 0 && buyAt != null) {
            const numGroups = Math.floor(qty / buyCount);
            const eligibleQty = numGroups * buyCount;

            if (eligibleQty > 0) {
                const base = unitPriceBefore;
                const basePaise = Math.round(base * 100);
                const bundlePricePaise = Math.round(buyAt * 100);

                const discBase = Math.floor(bundlePricePaise / buyCount);
                const remainder = bundlePricePaise % buyCount;

                let qtyLeftEligible = eligibleQty;
                let remainderCount = remainder * numGroups;

                const unitArray = [];
                for (let i = 0; i < qty; i++) {
                    if (qtyLeftEligible > 0) {
                        let pricePaise = discBase;
                        if (remainderCount > 0) {
                            pricePaise += 1;
                            remainderCount--;
                        }
                        unitArray.push(pricePaise / 100);
                        qtyLeftEligible--;
                    } else {
                        unitArray.push(basePaise / 100);
                    }
                }

                discountedTotal = Number(unitArray.reduce((a, b) => a + b, 0).toFixed(2));
                offerApplied = true;
                offerStatus = 'applied';
                console.log('[BuyNow][CheckOffer] buy_x_at_x applied:', {
                    numGroups,
                    eligibleQty,
                    originalTotal,
                    discountedTotal,
                });
            } else {
                offerApplied = false;
                offerStatus = 'missing';
                console.log('[BuyNow][CheckOffer] buy_x_at_x present but qty not sufficient:', {
                    buyCount,
                    qty,
                });
            }
        } else {
            offerApplied = false;
            offerStatus = 'missing';
            console.log('[BuyNow][CheckOffer] Unsupported or misconfigured offerType:', offerType);
        }

        const savedAmount = Math.max(0, Number((originalTotal - discountedTotal).toFixed(2)));

        console.log('[BuyNow][CheckOffer] Final offer preview:', {
            offerApplied,
            offerStatus,
            freeUnits,
            paidUnits,
            originalTotal,
            discountedTotal,
            savedAmount,
        });

        return res.status(200).json({
            success: true,
            offerApplied,
            offerStatus,
            offerID: offer.offerID,
            offerName,
            freeUnits,
            paidUnits,
            originalTotal,
            discountedTotal,
            savedAmount,
            requiredQty: offerType === 'buy_x_get_y' || offerType === 'buy_x_at_x' ? buyCount + (offerType === 'buy_x_get_y' ? getCount : 0) : null,
        });
    } catch (err) {
        console.error('Buy Now offer check error:', err);
        return res.status(500).json({
            success: false,
            offerApplied: false,
            message: err.message || 'Failed to check offer',
        });
    }
};

module.exports = {
    buyNowController,
    validateCoupon,
    checkOffer,
};

