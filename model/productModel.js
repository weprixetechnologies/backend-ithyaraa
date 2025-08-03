const db = require('../utils/dbconnect')

const uploadProduct = async ({
    name,
    description,
    regularPrice,
    salePrice,
    discountType,
    discountValue,
    type,
    categoryName,
    categoryID,
    status,
    offerID,
    overridePrice,
    tab1,
    tab2,
    productID,
    featuredImage
}) => {
    const query = `
        INSERT INTO products (
            name,
            description,
            regularPrice,
            salePrice,
            discountType,
            discountValue,
            type,
            categoryName,
            categoryID,
            status,
            offerID,
            overridePrice,
            tab1,
            tab2,
            productID,
            featuredImage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ,? ,?, ?, ?, ?, ?, ?, ?,?)
    `;

    try {
        const [result] = await db.query(query, [
            name,
            description,
            regularPrice,
            salePrice,
            discountType,
            discountValue,
            type,
            categoryName,
            categoryID,
            status,
            offerID,
            overridePrice,
            tab1,
            tab2,
            productID,
            JSON.stringify(featuredImage)
        ]);

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


const uploadVariations = async ({
    variationName,
    variationSlug,
    variationID,
    variationPrice,
    variationStock,
    variationValues,
    productID
}) => {
    const query = `
        INSERT INTO variations (
            variationName, 
            variationSlug, 
            variationID, 
            variationPrice, 
            variationStock, 
            variationValues, 
            productID
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        const [result] = await db.query(query, [
            variationName,
            variationSlug,
            variationID,
            variationPrice,
            variationStock,
            JSON.stringify(variationValues),
            productID
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




module.exports = { uploadVariations, uploadProduct }