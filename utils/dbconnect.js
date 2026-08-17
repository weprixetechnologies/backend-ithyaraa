const mysql = require('mysql2')

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rseditz@222',
    database: process.env.DB_NAME || 'ithyaraa',
    timezone: '+05:30'
})

module.exports = pool.promise();