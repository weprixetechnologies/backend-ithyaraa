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
    categories,
    brandName,
    galleryImage,
    brandID,
    custom_inputs,
    allowCustomerImageUpload
}) => {
    const safeString = (str) => {
        if (str === null || str === undefined) return '';
        return typeof str === 'string' ? str.replace(/'/g, "''") : String(str);
    };

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
            categories,
            brand,
            galleryImage,
            brandID,
            custom_inputs,
            allowCustomerImageUpload
        ) VALUES (
            '${safeString(name)}',
            '${safeString(description)}',
            ${regularPrice},
            ${salePrice},
            '${safeString(discountType)}',
            ${discountValue},
            '${safeString(type)}',
            '${safeString(status || 'In Stock')}',
            ${offerId === null || offerId === undefined ? 'NULL' : `'${safeString(offerId)}'`},
            ${overridePrice === null || overridePrice === undefined ? 'NULL' : `'${safeString(overridePrice)}'`},
            '${safeString(tab1)}',
            '${safeString(tab2)}',
            '${safeString(productID)}',
            '${safeString(JSON.stringify(featuredImage))}',
            ${attributes === null || attributes === undefined ? 'NULL' : `'${safeString(JSON.stringify(attributes))}'`},
            ${categories === null || categories === undefined ? 'NULL' : `'${safeString(JSON.stringify(categories))}'`},
            ${brandName === null || brandName === undefined ? 'NULL' : `'${safeString(brandName)}'`},
            '${safeString(JSON.stringify(galleryImage))}',
            ${brandID === null || brandID === undefined ? 'NULL' : `'${safeString(brandID)}'`},
            ${custom_inputs === null || custom_inputs === undefined ? 'NULL' : `'${safeString(JSON.stringify(custom_inputs))}'`},
            ${allowCustomerImageUpload === true || allowCustomerImageUpload === 1 ? 1 : 0}
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
        productID, featuredImage, attributes, categories, brand, galleryImage, custom_inputs,
        allowCustomerImageUpload
    } = product;
    console.log(categories);

    const query = `
        UPDATE products SET
            name = ?, description = ?, regularPrice = ?, salePrice = ?,
            discountType = ?, discountValue = ?, type = ?,
            status = ?, offerID = ?, overridePrice = ?, tab1 = ?, tab2 = ?,
            featuredImage = ?, productAttributes = ?, categories = ?, brand = ?, galleryImage = ?, custom_inputs = ?, allowCustomerImageUpload = ?
        WHERE productID = ?
    `;

    const values = [
        name, description, regularPrice, salePrice, discountType, discountValue,
        type,
        status || 'In Stock', offerID || null, overridePrice || null, tab1, tab2,
        JSON.stringify(featuredImage),
        attributes ? JSON.stringify(attributes) : null,
        categories ? JSON.stringify(categories) : null,
        brand || null,
        JSON.stringify(galleryImage),
        custom_inputs ? JSON.stringify(custom_inputs) : null,
        allowCustomerImageUpload === true || allowCustomerImageUpload === 1 ? 1 : 0,
        productID,
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

const getProductByID = async (productID) => {
    try {
        const [rows] = await db.query(`SELECT * FROM products WHERE productID = ? LIMIT 1`, [productID]);
        if (!rows || rows.length === 0) return null;
        return rows[0];
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        throw error;
    }
};
const deleteVariationsByProductID = async (productID) => {
    return db.query(`DELETE FROM variations WHERE productID = ?`, [productID]);
};

const deleteProduct = async (productID) => {
    try {
        // Check if product exists first
        const [productRows] = await db.query(`SELECT productID FROM products WHERE productID = ?`, [productID]);
        if (productRows.length === 0) {
            return {
                success: false,
                error: 'Product not found'
            };
        }

        // Check for existing orders with this product
        const [orderRows] = await db.query(`SELECT COUNT(*) as count FROM order_items WHERE productID = ?`, [productID]);
        if (orderRows[0].count > 0) {
            return {
                success: false,
                error: 'Cannot delete product: It has been ordered by customers'
            };
        }

        // Delete related data first (foreign key constraints)
        // Note: Attributes are stored as JSON in products table, so no separate deletion needed

        // Delete from cart items
        await db.query(`DELETE FROM cart_items WHERE productID = ?`, [productID]);

        // Delete from wishlist items
        await db.query(`DELETE FROM wishlist_items WHERE productID = ?`, [productID]);

        // Delete from make combo items
        await db.query(`DELETE FROM make_combo_items WHERE productID = ?`, [productID]);

        // Delete variations
        await deleteVariationsByProductID(productID);

        // Delete the main product
        const [result] = await db.query(`DELETE FROM products WHERE productID = ?`, [productID]);

        return {
            success: result.affectedRows > 0,
            affectedRows: result.affectedRows
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};




module.exports = { deleteVariationsByProductID, uploadVariations, uploadProduct, checkIfVariationIDExists, getFilteredProductQuery, getProductWithVariations, getProductByID, editProductModel, deleteAttributesByProductID, deleteProduct }