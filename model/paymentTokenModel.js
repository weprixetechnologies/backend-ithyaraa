const db = require('./../utils/dbconnect');

async function createToken({ token, orderID, merchantTransactionId, type, expiresAt }) {
    const sql = `
        INSERT INTO payment_tokens (token, orderID, merchantTransactionId, type, expiresAt)
        VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(sql, [token, orderID, merchantTransactionId, type, expiresAt]);
    return result.affectedRows > 0;
}

async function getValidToken(token) {
    const sql = `
        SELECT * FROM payment_tokens 
        WHERE token = ? AND isUsed = FALSE AND expiresAt > NOW()
        LIMIT 1
    `;
    const [rows] = await db.query(sql, [token]);
    return rows[0] || null;
}

async function markTokenAsUsed(token) {
    const sql = `
        UPDATE payment_tokens 
        SET isUsed = TRUE 
        WHERE token = ?
    `;
    const [result] = await db.query(sql, [token]);
    return result.affectedRows > 0;
}

module.exports = {
    createToken,
    getValidToken,
    markTokenAsUsed
};
