// config.js
require('dotenv').config();

module.exports = {
    ACCESS_TOKEN_SECRET: process.env.JWT_SECRET,
    REFRESH_TOKEN_SECRET: process.env.JWT_SECRET,
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    REFRESH_TOKEN_EXPIRY_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 7
};
