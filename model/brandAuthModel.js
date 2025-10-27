const db = require('./../utils/dbconnect');

// Find brand user by username
const findBrandUserByUsername = async (username) => {
    const [rows] = await db.query(`SELECT * FROM users WHERE username = ? AND role = 'brand' LIMIT 1`, [username]);
    return rows[0] || null;
};

// Check if brand user exists by email
const findBrandUserByEmail = async (emailID) => {
    const [rows] = await db.query(
        `SELECT * FROM users WHERE emailID = ? AND role = 'brand' LIMIT 1`,
        [emailID]
    );
    return rows[0] || null;
};

// Find brand user by UID
const findBrandUserByUID = async (uid) => {
    const [rows] = await db.query(`SELECT * FROM users WHERE uid = ? AND role = 'brand' LIMIT 1`, [uid]);
    return rows[0] || null;
};

// Find any user by UID (across all roles) - for UID uniqueness check
const findUserByUID = async (uid) => {
    const [rows] = await db.query(`SELECT * FROM users WHERE uid = ? LIMIT 1`, [uid]);
    return rows[0] || null;
};

// Find any user by username (across all roles) - for username uniqueness check
const findUserByUsername = async (username) => {
    const [rows] = await db.query(`SELECT * FROM users WHERE username = ? LIMIT 1`, [username]);
    return rows[0] || null;
};

// Insert new brand user
const insertBrandUser = async (userData) => {
    const {
        uid,
        brandID,
        username,
        emailID,
        name,
        password,
        role,
        lastLogin,
        deviceInfo,
        joinedOn,
        verifiedEmail,
        createdOn,
        gstin,
        profilePhoto
    } = userData;

    await db.query(
        `INSERT INTO users 
        (uid, username, emailID, name, password, role, lastLogin, deviceInfo, joinedOn, verifiedEmail, createdOn, gstin, profilePhoto)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid, username, emailID, name, password, role, lastLogin, deviceInfo, joinedOn, verifiedEmail, createdOn, gstin, profilePhoto]
    );
};

// Delete session by email
const deleteSessionByEmail = async (emailID) => {
    await db.query(`DELETE FROM sessions WHERE email = ?`, [emailID]);
};

// Create session
const createSession = async (sessionData) => {
    const { username, email, refreshToken, deviceInfo } = sessionData;

    // Calculate expiry date (30 days from now, same as admin)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    const formattedExpiry = expiryDate.toISOString().slice(0, 19).replace('T', ' ');

    await db.query(
        `INSERT INTO sessions (username, email, refreshToken, deviceInfo, expiry) 
         VALUES (?, ?, ?, ?, ?)`,
        [username, email, refreshToken, deviceInfo, formattedExpiry]
    );
};

// Find session by refresh token
const findSessionByRefreshToken = async (refreshToken) => {
    const [rows] = await db.query(
        `SELECT * FROM sessions WHERE refreshToken = ? LIMIT 1`,
        [refreshToken]
    );
    return rows[0] || null;
};

// Find session by email
const findSessionByEmail = async (email) => {
    const [rows] = await db.query(
        `SELECT * FROM sessions WHERE email = ? LIMIT 1`,
        [email]
    );
    return rows[0] || null;
};

// Update session refresh token
const updateSessionRefreshToken = async (email, newRefreshToken) => {
    const [result] = await db.query(
        `UPDATE sessions SET refreshToken = ? WHERE email = ?`,
        [newRefreshToken, email]
    );
    return result.affectedRows > 0;
};

// Get all brands
const getAllBrands = async () => {
    const [rows] = await db.query(
        `SELECT uid, username, emailID, name, role, joinedOn, verifiedEmail, createdOn, gstin, profilePhoto
         FROM users 
         WHERE role = 'brand'
         ORDER BY createdOn DESC`
    );
    return rows;
};

// Update brand
const updateBrand = async (uid, updateData) => {
    const updates = [];
    const values = [];

    // Define allowed fields for brand updates
    const allowedFields = ['name', 'emailID', 'gstin', 'profilePhoto'];

    Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== 'uid' && allowedFields.includes(key)) {
            updates.push(`${key} = ?`);
            values.push(updateData[key]);
        }
    });

    if (updates.length === 0) {
        throw new Error('No valid fields to update');
    }

    values.push(uid);

    await db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE uid = ? AND role = 'brand'`,
        values
    );
};

// Delete brand
const deleteBrand = async (uid) => {
    // First delete sessions
    const brand = await findBrandUserByUID(uid);
    if (brand && brand.emailID) {
        await deleteSessionByEmail(brand.emailID);
    }

    // Then delete the brand
    await db.query(`DELETE FROM users WHERE uid = ? AND role = 'brand'`, [uid]);
};

module.exports = {
    findBrandUserByUsername,
    findBrandUserByEmail,
    findBrandUserByUID,
    findUserByUID,
    findUserByUsername,
    insertBrandUser,
    deleteSessionByEmail,
    createSession,
    findSessionByRefreshToken,
    findSessionByEmail,
    updateSessionRefreshToken,
    getAllBrands,
    updateBrand,
    deleteBrand
};
