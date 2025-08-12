const db = require('./../utils/dbconnect.js')
const { REFRESH_TOKEN_EXPIRY_DAYS } = require("./../utils/config.js");

const findByEmailOrPhone = async (emailID, phonenumber) => {
    const [rows] = await db.query(
        "SELECT * FROM users WHERE emailID = ? OR phonenumber = ?",
        [emailID, phonenumber]
    );
    return rows;
};

const createUser = async (user) => {
    await db.query(
        `INSERT INTO users 
            (uid, username, emailID, phonenumber, deviceInfo, joinedOn, verifiedEmail, verifiedPhone, balance, createdOn, name, password, role) 
         VALUES (?, ?, ?, ?, ?, NOW(), 0, 0, 0, NOW(), ?, ?, ?)`,
        [
            user.uid,
            user.username,
            user.emailID,
            user.phonenumber,
            user.deviceInfo,
            user.name,
            user.password,
            user.role
        ]
    );
};

const createSession = async (session) => {
    await db.query(
        `INSERT INTO sessions (username, email, phonenumber, refreshToken, deviceInfo, expiry) 
         VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [
            session.username,
            session.emailID,
            session.phonenumber,
            session.refreshToken,
            session.deviceInfo,
            REFRESH_TOKEN_EXPIRY_DAYS
        ]
    );
};

const findUserByEmail = async (email) => {
    const [rows] = await db.query('SELECT * FROM users WHERE emailID = ?', [email]);
    return rows[0] || null;
};





const updateRefreshToken = async (email, newRefreshToken) => {
    const [result] = await db.execute(
        'UPDATE sessions SET refreshToken = ? WHERE email = ?',
        [newRefreshToken, email]
    );
    return result.affectedRows > 0;
}





module.exports = { updateRefreshToken, createSession, createUser, findByEmailOrPhone, findUserByEmail }