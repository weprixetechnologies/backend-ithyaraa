const db = require('../utils/dbconnect');

/**
 * Create a presale booking order
 * @param {Object} bookingData - Booking data including uid, address details, productID, paymentMode, etc.
 * @returns {Object} - Created booking with preBookingID
 */
async function createPresaleBooking(bookingData) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const {
            uid,
            addressLine1,
            addressLine2 = null,
            pincode,
            landmark = null,
            state,
            city,
            phoneNumber,
            productID,
            paymentMode,
            subtotal,
            total,
            discount = 0,
            quantity = 1,
            productPrice,
            productName,
            presaleProductID,
            variationID = null,
            variationSlug = null,
            variationName = null,
            salePrice,
            regularPrice,
            unitPrice = null,
            unitSalePrice = null,
            featuredImage = null,
            referBy = null,
            brandID = null
        } = bookingData;

        // Determine status based on payment mode
        const paymentModeUpper = (paymentMode || 'COD').toUpperCase();
        let orderStatus = 'pending';
        let status = 'pending';
        let paymentStatus = 'pending';

        if (paymentModeUpper === 'COD') {
            orderStatus = 'pending';
            status = 'confirmed';
            paymentStatus = 'pending'; // Will be updated when COD is delivered
        } else {
            // PREPAID or PHONEPE
            orderStatus = 'pending';
            status = 'pending';
            paymentStatus = 'pending';
        }

        // Map payment mode to paymentType
        const paymentType = paymentModeUpper === 'COD' ? 'COD' : (paymentModeUpper === 'PHONEPE' ? 'PHONEPE' : 'PREPAID');

        // Insert into presale_booking_details (preBookingID is auto-increment)
        const [detailResult] = await connection.query(
            `INSERT INTO presale_booking_details (
                uid, addressLine1, addressLine2, pincode, landmark, state, city, phoneNumber,
                subtotal, total, discount, deliveryCompany, trackingCode,
                paymentStatus, orderStatus, status, txnID, merchantID,
                isWalletUsed, paidWallet, coinsEarned, paymentType, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                uid,
                addressLine1,
                addressLine2,
                pincode,
                landmark,
                state,
                city,
                phoneNumber,
                subtotal,
                total,
                discount,
                null, // deliveryCompany
                null, // trackingCode
                paymentStatus,
                orderStatus,
                status,
                null, // txnID (will be set when payment is initiated)
                null, // merchantID (will be set when payment is initiated)
                0, // isWalletUsed
                0, // paidWallet
                0, // coinsEarned
                paymentType
            ]
        );

        // Get the auto-generated preBookingID
        const preBookingID = detailResult.insertId;

        // Deduct variation stock if variationID is provided
        if (variationID) {
            const [stockResult] = await connection.query(
                `SELECT variationStock FROM variations WHERE variationID = ?`,
                [variationID]
            );

            if (stockResult.length === 0) {
                throw new Error('Variation not found');
            }

            const currentStock = parseInt(stockResult[0].variationStock || 0);
            if (currentStock < quantity) {
                throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`);
            }

            // Deduct stock
            await connection.query(
                `UPDATE variations
                 SET variationStock = variationStock - ?
                 WHERE variationID = ?`,
                [quantity, variationID]
            );

            console.log(`Deducted ${quantity} from variation ${variationID} stock`);
        }

        // Insert into presale_booking_items
        await connection.query(
            `INSERT INTO presale_booking_items (
                preBookingID, productID, name,
                variationID, variationSlug, variationName,
                salePrice, regularPrice, unitPrice, unitSalePrice,
                featuredImage, referBy, brandID, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                preBookingID,
                productID,
                productName || null,
                variationID || null,
                variationSlug || null,
                variationName || null,
                salePrice || productPrice || 0,
                regularPrice || productPrice || 0,
                unitPrice || null,
                unitSalePrice || salePrice || productPrice || null,
                featuredImage || null,
                referBy || null,
                brandID || null
            ]
        );

        await connection.commit();

        return {
            preBookingID,
            orderStatus,
            status,
            paymentStatus,
            paymentType
        };
    } catch (error) {
        await connection.rollback();
        console.error('Error creating presale booking:', error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Update presale booking payment status
 * @param {string} preBookingID - PreBooking ID
 * @param {string} paymentStatus - Payment status (pending, successful, failed, refunded)
 * @param {string} txnID - Optional transaction ID
 * @param {string} merchantID - Optional merchant ID
 * @param {string} paymentType - Optional payment type (COD, PREPAID, PHONEPE) - used to determine if order status should be updated
 */
async function updatePresaleBookingPaymentStatus(preBookingID, paymentStatus, txnID = null, merchantID = null, paymentType = null) {
    try {
        const updateFields = ['paymentStatus = ?'];
        const updateValues = [paymentStatus];

        // Only update txnID if provided and not already set (to avoid overwriting)
        if (txnID) {
            // Check current txnID first
            const [current] = await db.query(
                `SELECT txnID FROM presale_booking_details WHERE preBookingID = ?`,
                [preBookingID]
            );

            // Only update if txnID is null or empty
            if (!current || !current[0] || !current[0].txnID) {
                updateFields.push('txnID = ?');
                updateValues.push(txnID);
            }
        }

        if (merchantID) {
            updateFields.push('merchantID = ?');
            updateValues.push(merchantID);
        }

        // If payment is successful, update status to confirmed
        if (paymentStatus === 'successful') {
            updateFields.push('status = ?');
            updateValues.push('confirmed');
        } else if (paymentStatus === 'pending') {
            // If payment status is changed to pending and payment type is PREPAID or PHONEPE,
            // also update order status to pending
            const paymentTypeUpper = (paymentType || '').toUpperCase();
            if (paymentTypeUpper === 'PREPAID' || paymentTypeUpper === 'PHONEPE') {
                updateFields.push('status = ?');
                updateValues.push('pending');
            }
        } else if (paymentStatus === 'failed') {
            // Keep status as pending for failed payments (don't change to confirmed)
            // Status remains as it was initially set
        }

        updateValues.push(preBookingID);

        await db.query(
            `UPDATE presale_booking_details 
             SET ${updateFields.join(', ')} 
             WHERE preBookingID = ?`,
            updateValues
        );
    } catch (error) {
        console.error('Error updating presale booking payment status:', error);
        throw error;
    }
}

/**
 * Add transaction IDs to presale booking
 * @param {string} preBookingID - PreBooking ID
 * @param {string} txnID - Transaction ID
 * @param {string} merchantID - Merchant ID
 */
async function addmerchantID(preBookingID, txnID, merchantID = null) {
    try {
        const updateFields = ['txnID = ?'];
        const updateValues = [txnID];

        if (merchantID) {
            updateFields.push('merchantID = ?');
            updateValues.push(merchantID);
        }

        updateValues.push(preBookingID);

        await db.query(
            `UPDATE presale_booking_details 
             SET ${updateFields.join(', ')} 
             WHERE preBookingID = ?`,
            updateValues
        );
    } catch (error) {
        console.error('Error adding merchant transaction ID:', error);
        throw error;
    }
}

/**
 * Get presale booking by preBookingID
 * @param {string} preBookingID - PreBooking ID
 * @returns {Object|null} - Booking details or null
 */
async function getPresaleBookingByID(preBookingID) {
    try {
        const [rows] = await db.query(
            `SELECT * FROM presale_booking_details WHERE preBookingID = ?`,
            [preBookingID]
        );
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Error getting presale booking:', error);
        throw error;
    }
}

/**
 * Get presale booking by transaction ID
 * @param {string} txnID - Transaction ID
 * @returns {Object|null} - Booking details or null
 */
async function getPresaleBookingBymerchantID(txnID) {
    try {
        const [rows] = await db.query(
            `SELECT * FROM presale_booking_details WHERE txnID = ?`,
            [txnID]
        );
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Error getting presale booking by transaction ID:', error);
        throw error;
    }
}

/**
 * Get presale booking items by preBookingID
 * @param {string} preBookingID - PreBooking ID
 * @returns {Array} - Array of booking items
 */
async function getPresaleBookingItems(preBookingID) {
    try {
        const [rows] = await db.query(
            `SELECT * FROM presale_booking_items WHERE preBookingID = ?`,
            [preBookingID]
        );
        return rows;
    } catch (error) {
        console.error('Error getting presale booking items:', error);
        throw error;
    }
}

module.exports = {
    createPresaleBooking,
    updatePresaleBookingPaymentStatus,
    addmerchantID,
    getPresaleBookingByID,
    getPresaleBookingBymerchantID,
    getPresaleBookingItems
};

