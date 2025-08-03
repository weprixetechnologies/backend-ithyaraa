const db = require('../utils/dbconnect')

const addSessionDb = async (sessionData) => {
    try {
        const query = `
      INSERT INTO sessions 
        (session_id, username, email, phonenumber, refreshToken, deviceInfo, expiry)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

        const values = [
            sessionData.session_id,
            sessionData.username,
            sessionData.email,
            sessionData.phonenumber,
            sessionData.refreshToken,
            sessionData.deviceInfo,
            sessionData.expiry
        ];

        const [result] = await db.execute(query, values);
        return result;
    } catch (err) {
        console.error('Error inserting session into DB:', err);
        throw err;
    }
};
const createSession = async ({ username, email, phonenumber, refreshToken, deviceInfo, expiry }) => {
    await db.query(
        `INSERT INTO sessions (username, email, phonenumber, refreshToken, deviceInfo, expiry)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [username, email, phonenumber, refreshToken, deviceInfo, expiry]
    );
    return true
};

// Find session by email
const findSessionByEmail = async (email) => {
    const query = `SELECT * FROM sessions WHERE email = ? LIMIT 1`;
    const [rows] = await db.execute(query, [email]);
    return rows[0];
};

// Update session with new refresh token and expiry
const updateSessionTokens = async (email, refreshToken, expiry) => {
    const query = `
      UPDATE sessions
      SET refreshToken = ?, expiry = ?
      WHERE email = ?
    `;
    await db.execute(query, [refreshToken, expiry, email]);
};

const findUserExist = async (email) => {
    const query = `SELECT * FROM users WHERE emailID = ? LIMIT 1`;
    const [rows] = await db.execute(query, [email]);
    return rows[0];
}

const checkUidExists = async (uid) => {
    const query = `SELECT uid FROM users WHERE uid = ? LIMIT 1`;
    const [rows] = await db.execute(query, [uid]);
    return rows.length > 0;
};

const createUser = async ({ name, email, password, uid }) => {
    const lastLogin = new Date();
    const query = `INSERT INTO users (name, emailID, password, uid, username, lastLogin) VALUES (?, ?, ?, ?, ?, ?)`;
    const [result] = await db.execute(query, [name, email, password, uid, name, lastLogin]);

    return {
        id: result.insertId,
        name,
        email,
        uid,
        lastLogin
    };
};



const deleteSessionByEmail = async (email) => {
    await db.query('DELETE FROM sessions WHERE email = ?', [email]);
};

const getSessionByRefreshToken = async (refreshToken) => {
    const [rows] = await db.query('SELECT * FROM sessions WHERE refreshToken = ?', [refreshToken]);
    return rows[0];
};

const getSessionByEmail = async (email) => {
    const [rows] = await db.query('SELECT * FROM sessions WHERE email = ?', [email]);
    return rows[0];
};

module.exports = {
    getSessionByEmail,
    addSessionDb, findSessionByEmail, updateSessionTokens, findUserExist, createUser, checkUidExists, createSession, deleteSessionByEmail, getSessionByRefreshToken
};
