const db = require('./../utils/dbconnect')

const insertProduct = async (product) => {
    const {
        productID,
        name,
        description,
        type,
        featuredImage,
        regularPrice,
        salePrice,
        discountType,
        discountValue,
        status,
        categories,
        tab1,
        tab2,
        overridePrice,
        offerID, galleryImage } = product;

    const query = `
        INSERT INTO products 
        (productID, name, description, type, featuredImage, regularPrice, salePrice, discountType, discountValue, status,  categories, tab1, tab2, overridePrice, offerID, galleryImage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ,?,?)
    `;
    console.log('Product ', product);

    const values = [
        productID, name, description, type, JSON.stringify(featuredImage || []),
        regularPrice, salePrice, discountType, discountValue, status,
        JSON.stringify(categories || []),
        tab1 || null, tab2 || null, overridePrice || null, offerID || null, JSON.stringify(galleryImage || [])
    ];

    await db.query(query, values);
};

const getProductByID = async (productID) => {
    const [rows] = await db.query('SELECT * FROM products WHERE productID = ?', [productID]);
    console.log(productID);
    return rows[0];
};

const insertComboItem = async ({ productID, productName, featuredImage, categories, comboID }) => {
    const query = `
        INSERT INTO make_combo_items (productID, productName, featuredImage, categories, comboID)
        VALUES (?, ?, ?, ?, ?)
    `;

    const values = [productID, productName, featuredImage, JSON.stringify(categories || []), comboID];
    await db.query(query, values);
};

const getMainComboProduct = async (comboID) => {
    const [rows] = await db.execute(`
        SELECT * FROM products WHERE productID = ?
    `, [comboID]);
    return rows[0] || null;
};

const getComboItemProductIDs = async (comboID) => {
    const [rows] = await db.execute(`
        SELECT productID FROM make_combo_items WHERE comboID = ?
    `, [comboID]);
    return rows.map(row => row.productID);
};
const updateProduct = async (productID, data) => {
    // Define allowed columns based on your products table
    const allowedFields = new Set([
        'id', 'name', 'productID', 'description', 'regularPrice', 'salePrice',
        'discountType', 'discountValue', 'type', 'offerID', 'overridePrice',
        'tab1', 'tab2', 'featuredImage',
        'categories', 'galleryImage'
    ]);

    const fields = [];
    const values = [];

    for (const key of Object.keys(data)) {
        // Skip undefined fields or invalid columns
        if (!allowedFields.has(key)) continue;

        let value = data[key];

        if (typeof value === 'undefined') continue;

        if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
        }

        fields.push(`${key} = ?`);
        values.push(value);
    }

    if (fields.length === 0) {
        console.warn('No valid fields to update for productID:', productID);
        return;
    }

    const setClause = fields.join(', ');
    const query = `UPDATE products SET ${setClause} WHERE productID = ?`;

    await db.query(query, [...values, productID]);
};


const deleteComboItems = async (comboID) => {
    await db.query(`DELETE FROM make_combo_items WHERE comboID = ?`, [comboID]);
};


module.exports = {
    insertProduct,
    getProductByID,
    insertComboItem,
    getMainComboProduct, getComboItemProductIDs, updateProduct, deleteComboItems
};
