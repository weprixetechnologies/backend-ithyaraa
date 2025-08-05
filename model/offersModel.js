const db = require('./../utils/dbconnect')

const findOffersByName = async (offerName) => {
    const query = `SELECT * FROM offers WHERE offerName LIKE ?`;
    const [rows] = await db.execute(query, [`%${offerName}%`]);
    return rows;
};

module.exports = { findOffersByName }