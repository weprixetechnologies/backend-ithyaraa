const presaleBookingModel = require('../model/presaleBookingModel');
const presaleProductModel = require('../model/presaleProductModel');
const addressModel = require('../model/addressModel');
const cartModel = require('../model/cartModel');
const coinModel = require('../model/coinModel');
const db = require('../utils/dbconnect');

/**
 * Place a presale booking order
 * @param {string} uid - User ID
 * @param {string} addressID - Address ID
 * @param {string} productID - Product ID (presaleProductID)
 * @param {string} paymentMode - Payment mode (COD, PREPAID, PHONEPE)
 * @param {number} quantity - Quantity (default: 1)
 * @param {string} variationID - Optional variation ID
 * @returns {Object} - Booking order data
 */
async function placePresaleBookingOrder(uid, addressID, productID, paymentMode = 'COD', quantity = 1, variationID = null) {
    try {
        // Validate address
        const address = await addressModel.getAddressByID(addressID);
        if (!address) {
            throw new Error('Address not found');
        }
        // Verify address belongs to user
        if (address.uid !== uid) {
            throw new Error('Address does not belong to user');
        }

        // Get presale product details
        const product = await presaleProductModel.getPresaleProductByID(productID);
        if (!product) {
            throw new Error('Presale product not found');
        }

        // Check if product is available for booking
        if (product.status !== 'active') {
            throw new Error('Product is not available for booking');
        }

        // Validate quantity
        const qty = Math.max(1, parseInt(quantity) || 1);
        if (product.maxOrderQuantity && qty > product.maxOrderQuantity) {
            throw new Error(`Maximum order quantity is ${product.maxOrderQuantity}`);
        }
        if (product.minOrderQuantity && qty < product.minOrderQuantity) {
            throw new Error(`Minimum order quantity is ${product.minOrderQuantity}`);
        }

        // Handle variation if provided
        let variation = null;
        let variationName = null;
        let variationSlug = null;
        let salePrice = parseFloat(product.salePrice || 0);
        let regularPrice = parseFloat(product.regularPrice || 0);
        let unitPrice = null;
        let unitSalePrice = null;

        if (variationID) {
            variation = await cartModel.getVariationByID(variationID);
            if (!variation) {
                throw new Error('Variation not found');
            }

            // Verify variation belongs to the product
            if (variation.productID !== productID) {
                throw new Error('Variation does not belong to this product');
            }

            // Check variation stock
            const variationStock = parseInt(variation.variationStock || 0);
            if (variationStock < qty) {
                throw new Error(`Insufficient stock. Available: ${variationStock}, Requested: ${qty}`);
            }

            // Use variation price if available
            if (variation.variationSalePrice) {
                salePrice = parseFloat(variation.variationSalePrice);
                unitSalePrice = salePrice;
            } else if (variation.variationPrice) {
                salePrice = parseFloat(variation.variationPrice);
                unitSalePrice = salePrice;
            }

            if (variation.variationPrice) {
                regularPrice = parseFloat(variation.variationPrice);
                unitPrice = regularPrice;
            }

            variationName = variation.variationName || null;
            variationSlug = variation.variationSlug || null;
        } else {
            // For non-variation products, use product prices
            unitPrice = regularPrice;
            unitSalePrice = salePrice;
        }

        // Calculate pricing
        const productPrice = salePrice || regularPrice;
        const subtotal = productPrice * qty;
        const discount = 0; // Can be extended for discounts
        const total = subtotal - discount;

        // Parse featuredImage if it's a JSON string
        let featuredImage = product.featuredImage;
        if (typeof featuredImage === 'string') {
            try {
                featuredImage = JSON.parse(featuredImage);
            } catch (e) {
                featuredImage = featuredImage; // Keep as string if not valid JSON
            }
        }
        // If it's an array, take the first image or stringify
        if (Array.isArray(featuredImage) && featuredImage.length > 0) {
            featuredImage = typeof featuredImage[0] === 'string' ? featuredImage[0] : JSON.stringify(featuredImage);
        } else if (Array.isArray(featuredImage)) {
            featuredImage = null;
        }

        // Create booking with address fields
        const booking = await presaleBookingModel.createPresaleBooking({
            uid,
            addressLine1: address.line1 || address.addressLine1 || '',
            addressLine2: address.line2 || address.addressLine2 || null,
            pincode: address.pincode || address.postalCode || '',
            landmark: address.landmark || null,
            state: address.state || '',
            city: address.city || '',
            phoneNumber: address.phonenumber || address.phoneNumber || '',
            productID: product.presaleProductID,
            presaleProductID: product.presaleProductID,
            paymentMode,
            subtotal,
            total,
            discount,
            quantity: qty,
            productPrice,
            productName: product.name,
            variationID: variationID || null,
            variationSlug: variationSlug,
            variationName: variationName,
            salePrice,
            regularPrice,
            unitPrice,
            unitSalePrice,
            featuredImage,
            referBy: product.referBy || null,
            brandID: product.brandID || null
        });

        // Create pending coins (1 coin per ₹100 of total) - will be completed on delivery
        try {
            const totalRupees = Number(total) || 0;
            const coins = Math.floor(totalRupees / 100);
            if (coins > 0) {
                // Use 'presale' as refType to distinguish from regular orders
                await coinModel.createPendingCoins(uid, booking.preBookingID, coins, 'presale');
                // Persist on presale_booking_details.coinsEarned (for display purposes, even though pending)
                await db.query(`UPDATE presale_booking_details SET coinsEarned = ? WHERE preBookingID = ?`, [coins, booking.preBookingID]);
            }
        } catch (coinErr) {
            console.error('Failed to create pending coins for presale booking:', coinErr);
            // Non-blocking
        }

        return {
            preBookingID: booking.preBookingID,
            orderStatus: booking.orderStatus,
            status: booking.status,
            paymentStatus: booking.paymentStatus,
            paymentType: booking.paymentType,
            bookingData: {
                items: [{
                    presaleProductID: product.presaleProductID,
                    productID: product.presaleProductID,
                    productName: product.name,
                    variationID: variationID || null,
                    variationName: variationName,
                    quantity: qty,
                    price: productPrice,
                    lineTotal: total
                }],
                summary: {
                    subtotal,
                    discount,
                    total
                }
            }
        };
    } catch (error) {
        console.error('Error placing presale booking order:', error);
        throw error;
    }
}

/**
 * Get presale booking details by preBookingID
 * @param {string} preBookingID - PreBooking ID
 * @param {string} uid - User ID
 * @returns {Object} - Booking details in format compatible with order details
 */
async function getPresaleBookingDetails(preBookingID, uid) {
    try {
        const booking = await presaleBookingModel.getPresaleBookingByID(preBookingID);
        
        if (!booking) {
            return null;
        }

        // Check if the booking belongs to the user
        if (booking.uid !== uid) {
            return null;
        }

        // Get booking items
        const items = await presaleBookingModel.getPresaleBookingItems(preBookingID);
        
        // Calculate quantity from subtotal and unit price (quantity is not stored in DB)
        // For presale bookings, we can calculate it from: quantity = subtotal / unitPrice
        let bookingQuantity = 1;
        if (items.length > 0) {
            const firstItem = items[0];
            const unitPrice = parseFloat(firstItem.unitSalePrice || firstItem.salePrice || firstItem.unitPrice || firstItem.regularPrice || 0);
            const subtotal = parseFloat(booking.subtotal || 0);
            if (unitPrice > 0) {
                bookingQuantity = Math.round(subtotal / unitPrice);
            }
        }

        // Utility: safe JSON parser
        const safeParse = (value, fallback = null) => {
            try {
                let parsed = value;
                while (typeof parsed === "string") parsed = JSON.parse(parsed);
                return parsed;
            } catch {
                return fallback;
            }
        };

        // Process items to match order items format
        const processedItems = items.map(item => {
            const featuredImage = safeParse(item.featuredImage, []);
            
            // Build shipping address string
            const addressParts = [];
            if (booking.addressLine1) addressParts.push(booking.addressLine1);
            if (booking.addressLine2) addressParts.push(booking.addressLine2);
            if (booking.city) addressParts.push(booking.city);
            if (booking.state) addressParts.push(booking.state);
            if (booking.pincode) addressParts.push(booking.pincode);
            const shippingAddress = addressParts.join(', ');
            
            // Calculate line totals based on booking quantity
            const unitSalePrice = parseFloat(item.unitSalePrice || item.salePrice || 0);
            const unitRegularPrice = parseFloat(item.unitPrice || item.regularPrice || 0);
            
            return {
                orderID: booking.preBookingID,
                productID: item.productID,
                quantity: bookingQuantity, // Use quantity from booking level
                variationID: item.variationID || null,
                storedVariationName: item.variationName || null,
                salePrice: unitSalePrice,
                regularPrice: unitRegularPrice,
                unitPriceBefore: unitRegularPrice,
                unitPriceAfter: unitSalePrice,
                lineTotalBefore: unitRegularPrice * bookingQuantity,
                lineTotalAfter: unitSalePrice * bookingQuantity,
                name: item.name || '',
                featuredImage: featuredImage,
                createdAt: item.createdAt,
                orderStatus: booking.orderStatus,
                paymentStatus: booking.paymentStatus,
                paymentMode: booking.paymentType,
                orderCreatedAt: booking.createdAt,
                email: '', // Will be populated from address if available
                contactNumber: booking.phoneNumber || '',
                shippingAddress: shippingAddress,
                // Add structured address fields for easier parsing
                addressLine1: booking.addressLine1 || '',
                addressLine2: booking.addressLine2 || '',
                city: booking.city || '',
                state: booking.state || '',
                pincode: booking.pincode || '',
                landmark: booking.landmark || ''
            };
        });

        // Build orderDetail object compatible with order format
        // If payment failed, coinsEarned should be 0
        const paymentFailed = booking.paymentStatus === 'failed';
        const coinsEarned = paymentFailed ? 0 : parseInt(booking.coinsEarned || 0);
        
        const orderDetail = {
            orderID: booking.preBookingID,
            preBookingID: booking.preBookingID,
            subtotal: parseFloat(booking.subtotal || 0),
            totalDiscount: parseFloat(booking.discount || 0),
            total: parseFloat(booking.total || 0),
            paymentMode: booking.paymentType || 'COD',
            paymentStatus: booking.paymentStatus || 'pending',
            orderStatus: booking.orderStatus || 'pending',
            status: booking.status || 'pending',
            createdAt: booking.createdAt,
            coinsEarned: coinsEarned,
            isWalletUsed: booking.isWalletUsed ? Boolean(Number(booking.isWalletUsed)) : false,
            paidWallet: parseFloat(booking.paidWallet || 0),
            couponCode: null,
            couponDiscount: 0,
            shipping: 0, // Presale bookings typically don't have shipping charges upfront
            // Add delivery address details
            deliveryAddress: {
                line1: booking.addressLine1 || '',
                line2: booking.addressLine2 || '',
                city: booking.city || '',
                state: booking.state || '',
                pincode: booking.pincode || '',
                landmark: booking.landmark || '',
                phoneNumber: booking.phoneNumber || ''
            }
        };

        return {
            items: processedItems,
            orderDetail: orderDetail
        };
    } catch (error) {
        console.error('Error getting presale booking details:', error);
        throw error;
    }
}

/**
 * Get all presale bookings for a specific user with pagination and filters
 * @param {string} uid - User ID
 * @param {Object} filters - Filter options (page, limit, status, paymentStatus)
 * @returns {Object} - Bookings with pagination
 */
async function getUserPresaleBookings(uid, filters = {}) {
    try {
        const { page = 1, limit = 10, status, paymentStatus } = filters;
        const offset = (page - 1) * limit;

        let whereConditions = ['pbd.uid = ?'];
        let queryParams = [uid];

        // Build WHERE clause based on filters
        if (status) {
            whereConditions.push('pbd.orderStatus = ?');
            queryParams.push(status);
        }

        if (paymentStatus) {
            whereConditions.push('pbd.paymentStatus = ?');
            queryParams.push(paymentStatus);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        // Get total count
        const countQuery = `
            SELECT COUNT(DISTINCT pbd.preBookingID) as total
            FROM presale_booking_details pbd
            ${whereClause}
        `;

        const [countResult] = await db.query(countQuery, queryParams);
        const total = countResult[0]?.total || 0;

        // Get bookings with pagination
        const bookingsQuery = `
            SELECT DISTINCT 
                pbd.preBookingID,
                pbd.uid,
                pbd.paymentType as paymentMode,
                pbd.paymentStatus,
                pbd.orderStatus,
                pbd.status,
                pbd.subtotal,
                pbd.discount as totalDiscount,
                pbd.total,
                pbd.createdAt,
                COUNT(pbi.preBookingID) as itemCount
            FROM presale_booking_details pbd
            LEFT JOIN presale_booking_items pbi ON pbd.preBookingID = pbi.preBookingID
            ${whereClause}
            GROUP BY pbd.preBookingID, pbd.uid, pbd.paymentType, pbd.paymentStatus, 
                     pbd.orderStatus, pbd.status, pbd.subtotal, pbd.discount, 
                     pbd.total, pbd.createdAt
            ORDER BY pbd.createdAt DESC
            LIMIT ? OFFSET ?
        `;

        queryParams.push(parseInt(limit), parseInt(offset));
        const [bookings] = await db.query(bookingsQuery, queryParams);

        return {
            bookings,
            total
        };
    } catch (error) {
        console.error('Error getting user presale bookings:', error);
        throw error;
    }
}

/**
 * Get all presale bookings for admin with pagination and filters
 * @param {Object} filters - Filter options
 * @returns {Object} - Bookings with pagination
 */
async function getAllPresaleBookings(filters = {}) {
    try {
        const { page = 1, limit = 10, offset = 0, status, paymentStatus, search } = filters;

        let whereConditions = [];
        let queryParams = [];

        // Build WHERE clause based on filters
        if (status) {
            whereConditions.push('pbd.orderStatus = ?');
            queryParams.push(status);
        }

        if (paymentStatus) {
            whereConditions.push('pbd.paymentStatus = ?');
            queryParams.push(paymentStatus);
        }

        if (search) {
            whereConditions.push('(pbd.preBookingID LIKE ? OR u.username LIKE ? OR u.emailID LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Get total count
        const countQuery = `
            SELECT COUNT(DISTINCT pbd.preBookingID) as total
            FROM presale_booking_details pbd
            LEFT JOIN users u ON pbd.uid = u.uid
            ${whereClause}
        `;

        const [countResult] = await db.query(countQuery, queryParams);
        const total = countResult[0]?.total || 0;

        // Get bookings with pagination
        const bookingsQuery = `
            SELECT DISTINCT 
                pbd.preBookingID,
                pbd.uid,
                pbd.paymentType as paymentMode,
                pbd.paymentStatus,
                pbd.orderStatus,
                pbd.status,
                pbd.subtotal,
                pbd.discount,
                pbd.total,
                pbd.createdAt,
                u.username,
                u.emailID,
                u.phonenumber,
                COUNT(pbi.preBookingID) as itemCount
            FROM presale_booking_details pbd
            LEFT JOIN users u ON pbd.uid = u.uid
            LEFT JOIN presale_booking_items pbi ON pbd.preBookingID = pbi.preBookingID
            ${whereClause}
            GROUP BY pbd.preBookingID, pbd.uid, pbd.paymentType, pbd.paymentStatus, 
                     pbd.orderStatus, pbd.status, pbd.subtotal, pbd.discount, 
                     pbd.total, pbd.createdAt, u.username, u.emailID, u.phonenumber
            ORDER BY pbd.createdAt DESC
            LIMIT ? OFFSET ?
        `;

        queryParams.push(parseInt(limit), parseInt(offset));
        const [bookings] = await db.query(bookingsQuery, queryParams);

        return {
            bookings,
            total
        };
    } catch (error) {
        console.error('Error getting all presale bookings:', error);
        throw error;
    }
}

/**
 * Get presale booking details for admin (no user check)
 * @param {string} preBookingID - PreBooking ID
 * @returns {Object} - Booking details
 */
async function getAdminPresaleBookingDetails(preBookingID) {
    try {
        const booking = await presaleBookingModel.getPresaleBookingByID(preBookingID);
        
        if (!booking) {
            return null;
        }

        // Get booking items
        const items = await presaleBookingModel.getPresaleBookingItems(preBookingID);
        
        // Get user details
        const [users] = await db.query(
            `SELECT username, emailID, phonenumber FROM users WHERE uid = ?`,
            [booking.uid]
        );
        const user = users[0] || {};

        // Calculate quantity from subtotal and unit price
        let bookingQuantity = 1;
        if (items.length > 0) {
            const firstItem = items[0];
            const unitPrice = parseFloat(firstItem.unitSalePrice || firstItem.salePrice || firstItem.unitPrice || firstItem.regularPrice || 0);
            const subtotal = parseFloat(booking.subtotal || 0);
            if (unitPrice > 0) {
                bookingQuantity = Math.round(subtotal / unitPrice);
            }
        }

        // Utility: safe JSON parser
        const safeParse = (value, fallback = null) => {
            try {
                let parsed = value;
                while (typeof parsed === "string") parsed = JSON.parse(parsed);
                return parsed;
            } catch {
                return fallback;
            }
        };

        // Process items
        const processedItems = items.map(item => {
            const featuredImage = safeParse(item.featuredImage, []);
            
            const unitSalePrice = parseFloat(item.unitSalePrice || item.salePrice || 0);
            const unitRegularPrice = parseFloat(item.unitPrice || item.regularPrice || 0);
            
            return {
                productID: item.productID,
                quantity: bookingQuantity,
                variationID: item.variationID || null,
                variationName: item.variationName || null,
                salePrice: unitSalePrice,
                regularPrice: unitRegularPrice,
                lineTotalAfter: unitSalePrice * bookingQuantity,
                name: item.name || '',
                featuredImage: featuredImage
            };
        });

        return {
            orderID: booking.preBookingID,
            preBookingID: booking.preBookingID,
            items: processedItems,
            subtotal: parseFloat(booking.subtotal || 0),
            discount: parseFloat(booking.discount || 0),
            total: parseFloat(booking.total || 0),
            paymentMode: booking.paymentType || 'COD',
            paymentStatus: booking.paymentStatus || 'pending',
            orderStatus: booking.orderStatus || 'pending',
            status: booking.status || 'pending',
            createdAt: booking.createdAt,
            coinsEarned: parseInt(booking.coinsEarned || 0),
            trackingCode: booking.trackingCode || '',
            deliveryCompany: booking.deliveryCompany || '',
            deliveryAddress: {
                line1: booking.addressLine1 || '',
                line2: booking.addressLine2 || '',
                city: booking.city || '',
                state: booking.state || '',
                pincode: booking.pincode || '',
                landmark: booking.landmark || '',
                phoneNumber: booking.phoneNumber || ''
            },
            user: {
                username: user.username || '',
                emailID: user.emailID || '',
                phoneNumber: user.phonenumber || ''
            }
        };
    } catch (error) {
        console.error('Error getting admin presale booking details:', error);
        throw error;
    }
}

/**
 * Update presale booking order status
 * @param {string} preBookingID - PreBooking ID
 * @param {string} orderStatus - New order status
 * @returns {boolean} - Success status
 */
async function updatePresaleBookingStatus(preBookingID, orderStatus) {
    try {
        // Get booking details before updating to check for pending coins
        const [bookingBefore] = await db.query(
            'SELECT uid, orderStatus, coinsEarned FROM presale_booking_details WHERE preBookingID = ?',
            [preBookingID]
        );

        if (!bookingBefore || bookingBefore.length === 0) {
            return false;
        }

        const booking = bookingBefore[0];
        const oldStatus = booking.orderStatus;
        const uid = booking.uid;
        const hasPendingCoins = booking.coinsEarned > 0;

        // Update order status
        const [result] = await db.query(
            `UPDATE presale_booking_details SET orderStatus = ? WHERE preBookingID = ?`,
            [orderStatus, preBookingID]
        );

        if (result.affectedRows === 0) {
            return false;
        }

        // Handle coin state transitions based on status change
        if (hasPendingCoins) {
            try {
                const coinModel = require('../model/coinModel');
                const statusLower = orderStatus.toLowerCase();
                const oldStatusLower = oldStatus.toLowerCase();
                
                if (statusLower === 'delivered' && oldStatusLower !== 'delivered') {
                    // Complete pending coins (award them) when order is delivered
                    await coinModel.completePendingCoins(uid, preBookingID, 'presale');
                    console.log(`[Presale Coins] Completed pending coins for presale booking ${preBookingID}`);
                } else if ((statusLower === 'cancelled' || statusLower === 'returned') && oldStatusLower !== 'cancelled' && oldStatusLower !== 'returned') {
                    // Check if coins were already earned (booking was delivered) or still pending
                    if (oldStatusLower === 'delivered') {
                        // Reverse earned coins (coins were already awarded)
                        const result = await coinModel.reverseEarnedCoins(uid, preBookingID, 'presale');
                        if (result.success) {
                            console.log(`[Presale Coins] Reversed ${result.coinsReversed} earned coins for ${statusLower} presale booking ${preBookingID}`);
                        } else {
                            console.log(`[Presale Coins] ${result.message} for presale booking ${preBookingID}`);
                        }
                    } else {
                        // Reverse pending coins (booking was not yet delivered)
                        await coinModel.reversePendingCoins(uid, preBookingID, 'presale');
                        console.log(`[Presale Coins] Reversed pending coins for ${statusLower} presale booking ${preBookingID}`);
                    }
                }
            } catch (coinErr) {
                console.error('[Presale Coins] Error processing coin state change:', coinErr);
                // Don't fail the order status update if coin processing fails
            }
        }

        return true;
    } catch (error) {
        console.error('Error updating presale booking status:', error);
        throw error;
    }
}

/**
 * Update presale booking tracking information
 * @param {string} preBookingID - PreBooking ID
 * @param {string} trackingCode - Tracking code
 * @param {string} deliveryCompany - Delivery company
 * @returns {boolean} - Success status
 */
async function updatePresaleBookingTracking(preBookingID, trackingCode, deliveryCompany) {
    try {
        const updateFields = [];
        const updateValues = [];

        if (trackingCode !== undefined) {
            updateFields.push('trackingCode = ?');
            updateValues.push(trackingCode || null);
        }

        if (deliveryCompany !== undefined) {
            updateFields.push('deliveryCompany = ?');
            updateValues.push(deliveryCompany || null);
        }

        if (updateFields.length === 0) {
            return false;
        }

        updateValues.push(preBookingID);

        const [result] = await db.query(
            `UPDATE presale_booking_details SET ${updateFields.join(', ')} WHERE preBookingID = ?`,
            updateValues
        );

        return result.affectedRows > 0;
    } catch (error) {
        console.error('Error updating presale booking tracking:', error);
        throw error;
    }
}

module.exports = {
    placePresaleBookingOrder,
    getPresaleBookingDetails,
    getUserPresaleBookings,
    getAllPresaleBookings,
    getAdminPresaleBookingDetails,
    updatePresaleBookingStatus,
    updatePresaleBookingTracking
};
