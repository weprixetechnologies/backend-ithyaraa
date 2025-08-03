const argon2 = require('argon2')
const authModel = require('./../model/authModel')
const jwt = require('jsonwebtoken')

const generateAccessToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30m' });
};

const generateRefreshToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const hashPassword = (password) => {
    const hashedPass = argon2.hash(password)
    return hashedPass;
}

const verifyAccessToken = (token) => {
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        return {
            valid: true,
            payload
        };
    } catch (err) {
        return {
            valid: false,
            error: err.message
        };
    }
};

const decodePassword = (hashed, password) => {
    const decoded = argon2.verify(hashed, password)
    return decoded;
}
const generateUID = async () => {
    const prefix = 'UITHY';
    const length = 6;

    const randomString = () => Math.random().toString(36).substring(2, 2 + length).toUpperCase();

    let uid;
    let exists = true;

    while (exists) {
        uid = prefix + randomString();
        exists = await authModel.checkUidExists(uid);
    }

    return uid;
};

const refreshUserSession = async (oldRefreshToken) => {
    let decoded;

    try {
        decoded = jwt.verify(oldRefreshToken, process.env.JWT_SECRET);
    } catch (err) {
        throw new Error('Invalid or expired refresh token');
    }
    console.log(decoded);

    const email = decoded.email;
    const session = await authModel.getSessionByEmail(email);

    if (!session || session.refreshToken !== oldRefreshToken) {
        throw new Error('Session not found or token mismatch');
    }

    const payload = { uid: decoded.uid, email: decoded.email };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    const formattedExpiry = expiryDate.toISOString().slice(0, 19).replace('T', ' ');

    await authModel.updateSessionTokens(email, newRefreshToken, formattedExpiry);

    return {
        accessToken,
        newRefreshToken
    };
};

module.exports = {
    generateAccessToken,
    generateRefreshToken, hashPassword, decodePassword, generateUID, refreshUserSession, verifyAccessToken
};