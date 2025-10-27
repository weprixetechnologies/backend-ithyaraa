const db = require('../utils/dbconnect');

const addAddress = async (addressData) => {
    console.log(addressData);

    const sql = `INSERT INTO address 
      (uid, emailID, line1, line2, pincode, city, state, landmark, type, addressID, phonenumber)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`;

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
        addressData.addressID,
        addressData.phonenumber
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
const getAddresses = async (uid, emailID) => {
    let sql = `SELECT * FROM address WHERE 1=1`;
    const params = [];

    if (uid) {
        sql += ` AND uid = ?`;
        params.push(uid);
    }
    if (emailID) {
        sql += ` AND emailID = ?`;
        params.push(emailID);
    }

    const [rows] = await db.execute(sql, params);
    return rows;
};
const deleteAddress = async (addressID) => {
    const sql = `DELETE FROM address WHERE addressID = ?`;
    const [result] = await db.execute(sql, [addressID]);
    return result.affectedRows > 0; // true if deleted, false if not found
};

const getAddressByID = async (addressID) => {
    const sql = `SELECT * FROM address WHERE addressID = ?`;
    const [rows] = await db.execute(sql, [addressID]);
    return rows[0] || null;
};

module.exports = { addAddress, checkAddressIDExists, checkUserExists, getAddresses, deleteAddress, getAddressByID };
