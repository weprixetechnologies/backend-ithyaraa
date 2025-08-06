const db = require('../utils/dbconnect')

const getFilteredProductQuery = (filters, values) => {
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const baseQuery = `SELECT * FROM products ${whereClause} ORDER BY createdAt DESC`;
    const countQuery = `SELECT COUNT(*) AS total FROM products ${whereClause}`;
    return { baseQuery, countQuery, values };
};


const uploadProduct = async ({
    name,
    description,
    regularPrice,
    salePrice,
    discountType,
    discountValue,
    type,
    status,
    offerId,
    overridePrice,
    tab1,
    tab2,
    productID,
    featuredImage,
    attributes,
    categories
}) => {
    const safeString = (str) =>
        typeof str === 'string' ? str.replace(/'/g, "''") : str;

    const query = `
        INSERT INTO products (
            name,
            description,
            regularPrice,
            salePrice,
            discountType,
            discountValue,
            type,
            status,
            offerID,
            overridePrice,
            tab1,
            tab2,
            productID,
            featuredImage,
            productAttributes,
            categories
        ) VALUES (
            '${safeString(name)}',
            '${safeString(description)}',
            ${regularPrice},
            ${salePrice},
            '${safeString(discountType)}',
            ${discountValue},
            '${safeString(type)}',
            '${safeString(status || 'In Stock')}',
            '${safeString(offerId)}',
            '${safeString(overridePrice || 'null')}',
            '${safeString(tab1)}',
            '${safeString(tab2)}',
            '${safeString(productID)}',
            '${safeString(JSON.stringify(featuredImage))}',
            '${safeString(JSON.stringify(attributes))}',
            '${safeString(JSON.stringify(categories))}'
        );
    `;

    try {
        const [result] = await db.query(query);
        return {
            success: true,
            message: 'Product inserted successfully',
            insertedId: result.insertId
        };
    } catch (error) {
        console.error('Error inserting product:', error);
        return {
            success: false,
            message: 'Failed to insert product',
            error: error.message
        };
    }
};
const deleteAttributesByProductID = async (productID) => {
    return db.query(`DELETE FROM attributes WHERE productID = ?`, [productID]);
};

const editProductModel = async (product) => {
    const {
        name, description, regularPrice, salePrice, discountType, discountValue,
        type, status, offerID, overridePrice, tab1, tab2,
        productID, featuredImage, attributes, categories
    } = product;

    const query = `
        UPDATE products SET
            name = ?, description = ?, regularPrice = ?, salePrice = ?,
            discountType = ?, discountValue = ?, type = ?,
            status = ?, offerID = ?, overridePrice = ?, tab1 = ?, tab2 = ?,
            featuredImage = ?, productAttributes = ?, categories = ?
        WHERE productID = ?
    `;

    const values = [
        name, description, regularPrice, salePrice, discountType, discountValue,
        type,
        status || 'In Stock', offerID, overridePrice || null, tab1, tab2,
        JSON.stringify(featuredImage), JSON.stringify(attributes), JSON.stringify(categories),
        productID
    ];

    try {
        await db.query(query, values);
        return { success: true, message: 'Product updated successfully' };
    } catch (error) {
        console.error('Error updating product:', error);
        return { success: false, message: 'Failed to update product', error: error.message };
    }
};



const uploadVariations = async ({
    variationName,
    variationSlug,
    variationID,
    variationPrice,
    variationStock,
    variationValues,
    productID,
    variationSalePrice
}) => {
    const query = `
        INSERT INTO variations (
            variationName, 
            variationSlug, 
            variationID, 
            variationPrice, 
            variationStock, 
            variationValues, 
            productID,
            variationSalePrice
        ) VALUES (?, ?, ?, ?, ?, ?, ?,?)
    `;

    try {
        const [result] = await db.query(query, [
            variationName,
            variationSlug,
            variationID,
            variationPrice,
            variationStock,
            JSON.stringify(variationValues),
            productID,
            variationSalePrice
        ]);

        return {
            success: true,
            message: 'Variation inserted successfully',
            insertedId: result.insertId
        };

    } catch (error) {
        console.error('Error inserting variation:', error);

        return {
            success: false,
            message: 'Failed to insert variation',
            error: error.message
        };
    }
};

const checkIfVariationIDExists = async (variationID) => {
    const [rows] = await db.query(
        'SELECT variationID FROM variations WHERE variationID = ?',
        [variationID]
    );
    return rows.length > 0;
};
const getProductWithVariations = async (productID) => {
    const [productRows] = await db.query(`SELECT * FROM products WHERE productID = ? LIMIT 1`, [productID]);

    if (productRows.length === 0) return null;

    const product = productRows[0];

    const [variationRows] = await db.query(`SELECT * FROM variations WHERE productID = ?`, [productID]);

    product.variations = variationRows;

    return product;
};
const deleteVariationsByProductID = async (productID) => {
    return db.query(`DELETE FROM variations WHERE productID = ?`, [productID]);
};




module.exports = { deleteVariationsByProductID, uploadVariations, uploadProduct, checkIfVariationIDExists, getFilteredProductQuery, getProductWithVariations, editProductModel, deleteAttributesByProductID, }