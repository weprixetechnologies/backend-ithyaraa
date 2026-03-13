const db = require('../utils/dbconnect');

/**
 * Resolves a full shipping address object from either:
 * 1. An existingAddressID (looks up from address table)
 * 2. A direct address object passed in the request body
 *
 * Returns a flat shipping snapshot object ready to be spread into an INSERT.
 *
 * @param {Object} params
 * @param {string|null} params.existingAddressID
 * @param {Object|null} params.addressBody
 * @param {string} params.uid
 * @param {Object|null} params.connection - Optional MySQL connection (within a transaction)
 */
async function resolveShippingAddress({ existingAddressID, addressBody, uid, connection }) {
    const query = connection
        ? (sql, params) => connection.query(sql, params)
        : (sql, params) => db.query(sql, params);

    if (existingAddressID) {
        const [rows] = await query(
            'SELECT * FROM address WHERE addressID = ? AND uid = ? LIMIT 1',
            [existingAddressID, uid]
        );
        if (!rows || rows.length === 0) {
            throw new Error('Address not found or does not belong to user');
        }
        const addr = rows[0];
        return {
            addressID: existingAddressID,
            shippingName:     addr.name || addr.fullName || '',
            shippingPhone:    addr.phoneNumber || addr.phonenumber || addr.phone || '',
            shippingEmail:    addr.emailID || addr.email || '',
            shippingLine1:    addr.line1 || addr.addressLine1 || '',
            shippingLine2:    addr.line2 || addr.addressLine2 || '',
            shippingCity:     addr.city || '',
            shippingState:    addr.state || '',
            shippingPincode:  addr.pincode || '',
            shippingLandmark: addr.landmark || '',
        };
    }

    if (addressBody) {
        return {
            addressID: null,
            shippingName:     addressBody.name        || addressBody.fullName    || '',
            shippingPhone:    addressBody.phoneNumber || addressBody.phone       || '',
            shippingEmail:    addressBody.emailID     || addressBody.email       || '',
            shippingLine1:    addressBody.line1       || '',
            shippingLine2:    addressBody.line2       || '',
            shippingCity:     addressBody.city        || '',
            shippingState:    addressBody.state       || '',
            shippingPincode:  addressBody.pincode     || '',
            shippingLandmark: addressBody.landmark    || '',
        };
    }

    throw new Error('Either existingAddressID or addressBody must be provided');
}

module.exports = { resolveShippingAddress };

