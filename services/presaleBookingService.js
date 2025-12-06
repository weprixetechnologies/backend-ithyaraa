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
            
            return {
                orderID: booking.preBookingID,
                productID: item.productID,
                quantity: 1, // Presale bookings typically have quantity 1 per item
                variationID: item.variationID || null,
                storedVariationName: item.variationName || null,
                salePrice: parseFloat(item.salePrice || 0),
                regularPrice: parseFloat(item.regularPrice || 0),
                unitPriceBefore: parseFloat(item.unitPrice || item.regularPrice || 0),
                unitPriceAfter: parseFloat(item.unitSalePrice || item.salePrice || 0),
                lineTotalBefore: parseFloat(item.regularPrice || 0),
                lineTotalAfter: parseFloat(item.salePrice || item.regularPrice || 0),
                name: item.name || '',
                featuredImage: featuredImage,
                createdAt: item.createdAt,
                orderStatus: booking.orderStatus,
                paymentStatus: booking.paymentStatus,
                paymentMode: booking.paymentType,
                orderCreatedAt: booking.createdAt,
                email: '', // Will be populated from address
                contactNumber: booking.phoneNumber || '',
                shippingAddress: `${booking.addressLine1}${booking.addressLine2 ? ', ' + booking.addressLine2 : ''}, ${booking.city}, ${booking.state}${booking.pincode ? ' - ' + booking.pincode : ''}`.replace(/,\s*,/g, ', ').replace(/^,\s+|\s+,$/g, '')
            };
        });

        // Build orderDetail object compatible with order format
        const orderDetail = {
            orderID: booking.preBookingID,
            subtotal: parseFloat(booking.subtotal || 0),
            totalDiscount: parseFloat(booking.discount || 0),
            total: parseFloat(booking.total || 0),
            paymentMode: booking.paymentType || 'online',
            paymentStatus: booking.paymentStatus || 'pending',
            orderStatus: booking.orderStatus || 'pending',
            createdAt: booking.createdAt,
            coinsEarned: parseInt(booking.coinsEarned || 0),
            isWalletUsed: booking.isWalletUsed ? Boolean(Number(booking.isWalletUsed)) : false,
            paidWallet: parseFloat(booking.paidWallet || 0),
            couponCode: null,
            couponDiscount: 0
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

module.exports = {
    placePresaleBookingOrder,
    getPresaleBookingDetails
};

