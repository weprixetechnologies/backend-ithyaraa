const jwt = require('jsonwebtoken')
const { ACCESS_TOKEN_SECRET, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_SECRET, REFRESH_TOKEN_EXPIRY_DAYS } = require("./config");

const generateAccessToken = (payload) => {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

const generateRefreshToken = (payload) => {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d` });
};

module.exports = { generateAccessToken, generateRefreshToken }