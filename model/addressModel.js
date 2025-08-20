const db = require('../utils/dbconnect');

const addAddress = async (addressData) => {
    const sql = `INSERT INTO address 
      (uid, emailID, line1, line2, pincode, city, state, landmark, type, addressID)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
        addressData.uid,
        addressData.emailID,
        addressData.line1,
        addressData.line2,
        addressData.pincode,
        addressData.city,
        addressData.state,
        addressData.landmark,
        addressData.type,
        addressData.addressID
    ];

    const [result] = await db.execute(sql, params);
    return result;
}

const checkAddressIDExists = async (addressID) => {
    const sql = `SELECT addressID FROM address WHERE addressID = ?`;
    const [rows] = await db.execute(sql, [addressID]);
    return rows.length > 0;
}

// Check if user exists
const checkUserExists = async (uid) => {
    const sql = `SELECT uid FROM users WHERE uid = ?`;
    const [rows] = await db.execute(sql, [uid]);
    return rows.length > 0;
}

module.exports = { addAddress, checkAddressIDExists, checkUserExists };
