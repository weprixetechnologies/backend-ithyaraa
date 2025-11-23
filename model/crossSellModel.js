const db = require('../utils/dbconnect');

/**
 * Insert cross-sell mappings for a product
 * @param {string} productID - The main product ID
 * @param {string[]} crossSellProductIDs - Array of cross-sell product IDs
 * @returns {Promise<{success: boolean, message: string}>}
 */
const insertCrossSells = async (productID, crossSellProductIDs) => {
    if (!productID || !Array.isArray(crossSellProductIDs) || crossSellProductIDs.length === 0) {
        return { success: true, message: 'No cross-sell products to insert' };
    }

    try {
        // Prepare bulk insert values
        const values = crossSellProductIDs.map(crossSellProductID => [productID, crossSellProductID]);
        
        const query = `
            INSERT INTO product_cross_sells (productID, crossSellProductID)
            VALUES ?
            ON DUPLICATE KEY UPDATE updatedAt = CURRENT_TIMESTAMP
        `;

        await db.query(query, [values]);
        
        return {
            success: true,
            message: 'Cross-sell mappings inserted successfully'
        };
    } catch (error) {
        console.error('Error inserting cross-sells:', error);
        return {
            success: false,
            message: 'Failed to insert cross-sell mappings',
            error: error.message
        };
    }
};

/**
 * Delete all cross-sell mappings for a product
 * @param {string} productID - The product ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
const deleteCrossSells = async (productID) => {
    if (!productID) {
        return { success: false, message: 'Product ID is required' };
    }

    try {
        const query = `DELETE FROM product_cross_sells WHERE productID = ?`;
        await db.query(query, [productID]);
        
        return {
            success: true,
            message: 'Cross-sell mappings deleted successfully'
        };
    } catch (error) {
        console.error('Error deleting cross-sells:', error);
        return {
            success: false,
            message: 'Failed to delete cross-sell mappings',
            error: error.message
        };
    }
};

/**
 * Fetch cross-sell products for a given product
 * @param {string} productID - The product ID
 * @returns {Promise<Array>} Array of cross-sell product objects
 */
const getCrossSellProducts = async (productID) => {
    if (!productID) {
        return [];
    }

    try {
        const query = `
            SELECT 
                p.*,
                pcs.crossSellProductID
            FROM product_cross_sells pcs
            INNER JOIN products p ON p.productID = pcs.crossSellProductID
            WHERE pcs.productID = ?
            ORDER BY pcs.createdAt DESC
        `;

        const [rows] = await db.query(query, [productID]);
        return rows || [];
    } catch (error) {
        console.error('Error fetching cross-sell products:', error);
        return [];
    }
};

module.exports = {
    insertCrossSells,
    deleteCrossSells,
    getCrossSellProducts
};

