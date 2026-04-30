const db = require('../utils/dbconnect');

const addFeedback = async ({ orderID, userID, rating, comment, tags }) => {
    const query = `
        INSERT INTO delivery_experience_feedback (orderID, userID, rating, comment, tags)
        VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [orderID, userID, rating, comment, tags]);
    return result.insertId;
};

const getAllFeedback = async () => {
    const query = `
        SELECT f.*, u.name as userName, u.emailID as userEmail, od.orderID
        FROM delivery_experience_feedback f
        JOIN users u ON f.userID = u.uid
        JOIN orderDetail od ON f.orderID = od.orderID
        ORDER BY f.createdOn DESC
    `;
    const [rows] = await db.query(query);
    return rows;
};

const getFeedbackByOrderID = async (orderID) => {
    const query = `SELECT * FROM delivery_experience_feedback WHERE orderID = ?`;
    const [rows] = await db.query(query, [orderID]);
    return rows[0];
};

module.exports = {
    addFeedback,
    getAllFeedback,
    getFeedbackByOrderID
};
