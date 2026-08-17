const db = require('../utils/dbconnect')

let columnsChecked = false;
const ensureOfferTableColumns = async () => {
    if (columnsChecked) return;
    try {
        await db.query(`ALTER TABLE offers ADD COLUMN IF NOT EXISTS discountType varchar(50) DEFAULT NULL`);
        await db.query(`ALTER TABLE offers ADD COLUMN IF NOT EXISTS discountValue decimal(10,2) DEFAULT NULL`);
        await db.query(`ALTER TABLE offers ADD COLUMN IF NOT EXISTS productScope varchar(50) DEFAULT 'different_product'`);
        columnsChecked = true;
    } catch (e) {
        try {
            const [cols] = await db.query(`SHOW COLUMNS FROM offers`);
            const colNames = cols.map(c => c.Field);
            if (!colNames.includes('discountType')) {
                await db.query(`ALTER TABLE offers ADD COLUMN discountType varchar(50) DEFAULT NULL`);
            }
            if (!colNames.includes('discountValue')) {
                await db.query(`ALTER TABLE offers ADD COLUMN discountValue decimal(10,2) DEFAULT NULL`);
            }
            if (!colNames.includes('productScope')) {
                await db.query(`ALTER TABLE offers ADD COLUMN productScope varchar(50) DEFAULT 'different_product'`);
            }
            columnsChecked = true;
        } catch (err) {
            console.error('Failed to add columns to offers table:', err);
        }
    }
};

const insertOffer = async (offerData) => {
    await ensureOfferTableColumns();
    const {
        offerID, offerName, offerType,
        buyAt, buyCount, getCount,
        discountType, discountValue, productScope,
        offerMobileBanner, offerBanner, products
    } = offerData;

    // Handle buyAt based on offer type
    const processedBuyAt = (offerType === 'buy_x_get_y' || offerType === 'buy_x_get_off') ? null : (buyAt || null);
    const processedGetCount = offerType === 'buy_x_get_off' ? 0 : (getCount || 0);

    const [result] = await db.query(
        `INSERT INTO offers (
            offerID, offerName, offerType,
            buyAt, buyCount, getCount,
            discountType, discountValue, productScope,
            offerMobileBanner, offerBanner, products
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            offerID, offerName, offerType,
            processedBuyAt, buyCount || 0, processedGetCount,
            discountType || null, discountValue != null ? Number(discountValue) : null, productScope || 'different_product',
            offerMobileBanner, offerBanner, products
        ]
    );

    return result;
};

const updateProductOfferID = async (productID, offerID) => {
    const query = `
        UPDATE products
        SET offerID = ?
        WHERE productID = ?
    `;
    const [result] = await db.execute(query, [offerID, productID]);
    return result;
};

const getFilteredOffers = async (filters = [], values = []) => {
    await ensureOfferTableColumns();
    let baseQuery = `SELECT * FROM offers`;

    if (filters.length > 0) {
        baseQuery += ` WHERE ${filters.join(' AND ')}`;
    }

    baseQuery += ` ORDER BY createdAt DESC`;

    const [rows] = await db.query(baseQuery, values);
    return rows;
};

const doesOfferIDExist = async (offerID) => {
    const [rows] = await db.query('SELECT offerID FROM offers WHERE offerID = ?', [offerID]);
    return rows.length > 0;
};

const getTotalOffers = async (filters, values) => {
    let query = 'SELECT COUNT(*) as total FROM offers';
    if (filters.length > 0) {
        query += ` WHERE ${filters.join(' AND ')}`;
    }

    const [rows] = await db.query(query, values);
    return rows[0].total || 0;
};

const updateOffer = async (offerID, data) => {
    await ensureOfferTableColumns();
    const keys = Object.keys(data);
    const values = Object.values(data);

    if (keys.length === 0) return { affectedRows: 0 };

    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const query = `UPDATE offers SET ${setClause} WHERE offerID = ?`;

    const [result] = await db.query(query, [...values, offerID]);
    return result;
};

const updateOfferByID = async (offerID, data) => {
    try {
        await ensureOfferTableColumns();
        const {
            offerName,
            offerType,
            buyAt,
            buyCount,
            getCount,
            discountType,
            discountValue,
            productScope,
            offerBanner,
            offerMobileBanner,
            products
        } = data;

        // Handle buyAt based on offer type
        const processedBuyAt = (offerType === 'buy_x_get_y' || offerType === 'buy_x_get_off') ? null : (buyAt || null);
        const processedGetCount = offerType === 'buy_x_get_off' ? 0 : (getCount || 0);

        const [result] = await db.query(
            `UPDATE offers 
             SET offerName = ?, 
                 offerType = ?, 
                 buyAt = ?,
                 buyCount = ?, 
                 getCount = ?, 
                 discountType = ?,
                 discountValue = ?,
                 productScope = ?,
                 offerBanner = ?, 
                 offerMobileBanner = ?,
                 products = ?
             WHERE offerID = ?`,
            [
                offerName, offerType, processedBuyAt,
                buyCount || 0, processedGetCount,
                discountType || null, discountValue != null ? Number(discountValue) : null, productScope || 'different_product',
                offerBanner, offerMobileBanner, products, offerID
            ]
        );

        return {
            success: true,
            message: 'Offer updated successfully',
            affectedRows: result.affectedRows,
        };
    } catch (error) {
        console.error('updateOfferByID error:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

const getOfferByID = async (offerID) => {
    try {
        await ensureOfferTableColumns();
        const [rows] = await db.query('SELECT * FROM offers WHERE offerID = ?', [offerID]);
        return rows.length ? rows[0] : null;
    } catch (error) {
        throw new Error('Error fetching offer: ' + error.message);
    }
};

const searchOfferByName = async (name) => {
    const query = `
        SELECT * FROM offers
        WHERE offerName LIKE ?
    `;
    const values = [`%${name}%`];

    const [rows] = await db.query(query, values);
    return rows;
};
const findOffersByName = async (offerName) => {
    const query = `SELECT * FROM offers WHERE offerName LIKE ?`;
    const [rows] = await db.execute(query, [`%${offerName}%`]);
    return rows;
};

const clearOfferIDFromProducts = async (offerID) => {
    const query = `
        UPDATE products
        SET offerID = NULL
        WHERE offerID = ?
    `;
    const [result] = await db.execute(query, [offerID]);
    return result;
};

const deleteOffer = async (offerID) => {
    try {
        const [result] = await db.execute('DELETE FROM offers WHERE offerID = ?', [offerID]);
        return {
            success: true,
            affectedRows: result.affectedRows
        };
    } catch (error) {
        console.error('deleteOffer error:', error);
        throw new Error('Error deleting offer: ' + error.message);
    }
};

module.exports = {
    searchOfferByName,
    insertOffer,
    doesOfferIDExist,
    getFilteredOffers,
    getTotalOffers,
    updateOffer,
    updateOfferByID,
    getOfferByID,
    findOffersByName,
    updateProductOfferID,
    clearOfferIDFromProducts,
    deleteOffer
};
