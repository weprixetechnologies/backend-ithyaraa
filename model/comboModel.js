const db = require('../utils/dbconnect');

// Insert new product
const createProduct = async (product) => {
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
        offerID } = product;

    const query = `
        INSERT INTO products 
        (productID, name, description, type, featuredImage, regularPrice, salePrice, discountType, discountValue, status,  categories, tab1, tab2, overridePrice, offerID)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    console.log('Product ', product);

    const values = [
        productID, name, description, type, JSON.stringify(featuredImage || []),
        regularPrice, salePrice, discountType, discountValue, status,
        JSON.stringify(categories || []),
        tab1 || null, tab2 || null, overridePrice || null, offerID || null
    ];

    await db.query(query, values);
};
// Get product by productID
const getProductByID = async (productID) => {
    const [rows] = await db.query(`SELECT * FROM products WHERE productID = ?`, [productID]);
    return rows[0];
};
// Get all products
const getAllProducts = async () => {
    const [rows] = await db.query(`SELECT * FROM products`);
    return rows;
};
const addComboItem = async (comboID, product) => {
    await db.query(
        `INSERT INTO combo_item (comboID, productID, name, featuredImage) VALUES (?, ?, ?, ?)`,
        [
            comboID,
            product.productID,
            product.name,
            product.featuredImage
        ]
    );
};
// Fetch combo product details
async function getComboDetails(comboID) {
    const [rows] = await db.query(
        `SELECT * FROM products WHERE productID = ?`,
        [comboID]
    );
    return rows[0] || null;
}
// Fetch associated product IDs in the combo
async function getComboItems(comboID) {
    const [rows] = await db.query(
        `SELECT productID FROM combo_item WHERE comboID = ?`,
        [comboID]
    );
    return rows.map(row => row.productID);
}

// Remove all items for a combo
async function deleteComboItems(comboID) {
    await db.query(
        `DELETE FROM combo_item WHERE comboID = ?`,
        [comboID]
    );
}

// Update combo product
async function updateComboProduct(productID, data) {
    const fields = [];
    const values = [];

    // Allowed columns in `products` table
    const allowedColumns = [
        "name", "description", "type", "featuredImage", "regularPrice", "salePrice",
        "discountType", "discountValue", "status", "categories", "tab1", "tab2",
        "overridePrice", "offerID"
    ];

    for (const key of Object.keys(data)) {
        if (!allowedColumns.includes(key)) continue; // ignore unknown fields

        let value = data[key];

        // Stringify objects/arrays
        if (typeof value === "object" && value !== null) {
            value = JSON.stringify(value);
        }

        fields.push(`${key} = ?`);
        values.push(value);
    }

    if (!fields.length) return 0; // no valid columns to update

    values.push(productID);

    const [result] = await db.query(
        `UPDATE products SET ${fields.join(', ')} WHERE productID = ?`,
        values
    );

    return result.affectedRows;
}

// Delete product by productID
const deleteProductByID = async (productID) => {
    const [result] = await db.query(
        'DELETE FROM products WHERE productID = ?',
        [productID]
    );
    return result.affectedRows;
};
const deleteComboItemsByComboID = async (comboID) => {
    const [result] = await db.query(
        'DELETE FROM combo_item WHERE comboID = ?',
        [comboID]
    );
    return result.affectedRows;
};

module.exports = { createProduct, getProductByID, getAllProducts, addComboItem, getComboDetails, getComboItems, updateComboProduct, deleteComboItems, deleteComboItemsByComboID, deleteProductByID }