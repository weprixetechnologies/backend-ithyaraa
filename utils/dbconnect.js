require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST || process.env.HOST || '127.0.0.1',
    user: process.env.DB_USER || process.env.USER || 'adminuser',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.PASSWORD !== undefined ? process.env.PASSWORD : 'Vishal@13241'),
    database: process.env.DB_NAME || process.env.DATABASE || 'ithyaraa',
    timezone: '+05:30'
});

module.exports = pool.promise();