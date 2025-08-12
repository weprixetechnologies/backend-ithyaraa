const db = require('./../utils/dbconnect');

const deleteSessionByEmail = async (email) => {
    const query = `DELETE FROM sessions WHERE email = ?`;
    await db.query(query, [email]);
};

const createSession = async ({ username, email, phonenumber, refreshToken, deviceInfo, expiry }) => {
    const query = `
        INSERT INTO sessions (username, email, phonenumber, refreshToken, deviceInfo, expiry)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    await db.query(query, [username, email, phonenumber, refreshToken, deviceInfo, expiry]);
};
const findSessionByEmail = async (email) => {
    const [rows] = await db.execute('SELECT * FROM sessions WHERE email = ?', [email]);
    return rows[0] || null;
}
const updateRefreshToken = async (email, newRefreshToken) => {
    const [result] = await db.execute(
        'UPDATE sessions SET refreshToken = ? WHERE email = ?',
        [newRefreshToken, email]
    );
    return result.affectedRows > 0;
}

module.exports = {
    deleteSessionByEmail,
    createSession,
    findSessionByEmail,
    updateRefreshToken
};
