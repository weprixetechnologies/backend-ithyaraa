const db = require('./../utils/dbconnect');
const createAdmin = async ({ name, email, password, uid, role }) => {
    try {
        const lastLogin = new Date();
        const username = `${uid}_admin`;

        const query = `
            INSERT INTO users (name, emailID, password, uid, lastLogin, role, username)
            VALUES (?, ?, ?, ?, ?, ?, ?)`;

        const [result] = await db.execute(query, [
            name,
            email,
            password,
            uid,
            lastLogin,
            role,
            username
        ]);

        return {
            id: result.insertId,
            name,
            email,
            uid,
            lastLogin,
            role,
            username
        };
    } catch (err) {
        console.error('Error in createAdmin:', err.message || err);
        throw err;
    }
};
module.exports = { createAdmin };
