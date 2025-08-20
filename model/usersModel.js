const db = require('./../utils/dbconnect');

// Find user by username
const findUserByUsername = async (username) => {
    const [rows] = await db.query(`SELECT * FROM users WHERE username = ? LIMIT 1`, [username]);
    return rows[0] || null;
};


// Check if user exists by email or phone
const findUserByEmailOrPhone = async (emailID, phonenumber) => {
    const [rows] = await db.query(
        `SELECT * FROM users WHERE emailID = ? OR phonenumber = ? LIMIT 1`,
        [emailID, phonenumber]
    );
    return rows[0];
};

// Insert new user
const insertUser = async (userData) => {
    const {
        uid,
        username,
        emailID,
        phonenumber,
        lastLogin,
        deviceInfo,
        joinedOn,
        verifiedEmail,
        verifiedPhone,
        balance,
        createdOn,
        name,
        password
    } = userData;

    await db.query(
        `INSERT INTO users 
        (uid, username, emailID, phonenumber, lastLogin, deviceInfo, joinedOn, verifiedEmail, verifiedPhone, balance, createdOn, name, password, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
        [uid, username, emailID, phonenumber, lastLogin, deviceInfo, joinedOn, verifiedEmail, verifiedPhone, balance, createdOn, name, password, 'user']
    );
};

const findUserByUID = async (uid) => {
    const [rows] = await db.query(`SELECT uid FROM users WHERE uid = ? LIMIT 1`, [uid]);
    console.log(rows);

    return rows[0];
};

const findUserByUIDFull = async (uid) => {
    const [rows] = await db.query(
        `SELECT * FROM users WHERE uid = ? LIMIT 1`,
        [uid]
    );
    console.log(rows); // This will log the full user object(s)

    return rows[0]; // Return the first (and only) user
};


// Delete session by email
const deleteSessionByEmail = async (emailID) => {
    await db.query(`DELETE FROM sessions WHERE email = ?`, [emailID]);
};

const findByEmail = async (emailID) => {
    const [rows] = await db.query(`SELECT * FROM sessions WHERE email = ?`, [emailID]);
    return rows[0] || null;
};
// Create new session
const createSession = async (sessionData) => {
    // my db has username, email, phonenumber, refreshToken, deviceInfo, expiry
    const { username, email, phonenumber, refreshToken, deviceInfo } = sessionData;

    // Calculate expiry date (7 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    await db.query(
        `INSERT INTO sessions (username, email, phonenumber, refreshToken, deviceInfo, expiry) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [username, email, phonenumber, refreshToken, deviceInfo, expiryDate]
    );
};

const findByuid = async (uid) => {
    const [rows] = await db.query(`SELECT * FROM users WHERE uid = ?`, [uid]);
    return rows[0] || null;
};

const updatePassword = async (uid, hashedPassword) => {
    await db.query(`UPDATE users SET password = ? WHERE uid = ?`, [hashedPassword, uid]);
};

const setEmailVerified = async (uid) => {
    const [result] = await db.query(
        'UPDATE users SET verifiedEmail = 1 WHERE uid = ?',
        [uid]
    );
    return result.affectedRows > 0;
};

async function findUserByEmail(email) {
    const [rows] = await db.execute(
        'SELECT * FROM users WHERE emailID = ? LIMIT 1',
        [email]
    );
    return rows[0];
}

async function findUserByPhone(phoneNumber) {
    const [rows] = await db.execute(
        'SELECT * FROM users WHERE phonenumber = ? LIMIT 1',
        [phoneNumber]
    );
    return rows[0];
}
async function insertOtpRecord({ identifier, otp, type, expiresAt }) {
    identifier = type === "email" ? identifier : `+91${identifier}`;
    // You can also store hash of otp for security if needed
    await db.execute(
        `INSERT INTO otp_sent (identifier, otpHash, type, expiry)
         VALUES (?, ?, ?,?)`,
        [identifier, otp, type, expiresAt]
    );
    return true;
}
const getOtpRecord = async (identifier) => {
    const [rows] = await db.execute(
        `SELECT * FROM otp_sent WHERE identifier = ? ORDER BY sentOn DESC LIMIT 1`,
        [identifier]
    );
    return rows[0];
};
async function getUserByIdentifier(identifierType, identifier) {


    const [rows] = await db.execute(
        `SELECT * FROM users WHERE ${identifierType} = ? LIMIT 1`,
        [identifier]
    );

    return rows[0];
}
module.exports = {
    findUserByEmailOrPhone,
    insertUser,
    findUserByUID,
    deleteSessionByEmail,
    createSession,
    findByuid,
    updatePassword,
    insertOtpRecord,
    findUserByUIDFull,
    findUserByUsername,
    setEmailVerified,
    findUserByEmail, findUserByPhone,
    getOtpRecord, getUserByIdentifier
};
