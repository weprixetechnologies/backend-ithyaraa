const db = require('../utils/dbconnect'); // your DB connection

// Fetch product by productID
async function getProductByID(productID) {
    const [rows] = await db.query(
        `SELECT productID, name, featuredImage, offerID, salePrice, regularPrice , brandID
     FROM products 
     WHERE productID = ?`,
        [productID]
    );
    return rows[0] || null;
}

// Get or create cartDetail for a user
async function getOrCreateCart(uid) {
    const [existing] = await db.query(
        `SELECT * FROM cartDetail WHERE uid = ? LIMIT 1`,
        [uid]
    );
    if (existing.length > 0) return existing[0];

    const [result] = await db.query(
        `INSERT INTO cartDetail (uid, subtotal, total, totalDiscount, anyModifications, modified) 
     VALUES (?, 0, 0, 0, FALSE, FALSE)`,
        [uid]
    );
    const [newCart] = await db.query(
        `SELECT * FROM cartDetail WHERE cartID = ?`,
        [result.insertId]
    );
    return newCart[0];
}

// Check if cart already has this product
async function getCartItem(cartID, productID) {
    const [rows] = await db.query(
        `SELECT * FROM cart_items WHERE cartID = ? AND productID = ? LIMIT 1`,
        [cartID, productID]
    );
    return rows[0] || null;
}

async function getCartItemByID(cartItemID) {
    const [rows] = await db.query(
        `SELECT * FROM cart_items WHERE cartItemID = ? LIMIT 1`,
        [cartItemID]
    );
    return rows[0] || null;
}

// Insert new cart item
async function insertCartItem(data) {
    const {
        cartID, uid, productID, quantity,
        regularPrice, salePrice, overridePrice,
        unitPriceBefore, unitPriceAfter,
        lineTotalBefore, lineTotalAfter,
        offerID, name, featuredImage, variationID, variationName, brandID, customInputs
    } = data;

    const [result] = await db.query(
        `INSERT INTO cart_items (
      cartID, uid, productID, quantity,
      regularPrice, salePrice, overridePrice,
      unitPriceBefore, unitPriceAfter,
      lineTotalBefore, lineTotalAfter,
      offerID, offerApplied, offerStatus, appliedOfferID,
      name, featuredImage, variationID, variationName, brandID, custom_inputs
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, 'none', NULL, ?, ?,?,?,?,?)`,
        [
            cartID, uid, productID, quantity,
            regularPrice, salePrice, overridePrice,
            unitPriceBefore, unitPriceAfter,
            lineTotalBefore, lineTotalAfter,
            offerID, name, featuredImage, variationID, variationName, brandID,
            customInputs ? JSON.stringify(customInputs) : null
        ]
    );
    const [inserted] = await db.query(
        `SELECT * FROM cart_items WHERE cartItemID = ?`,
        [result.insertId]
    );
    return inserted[0];
}

// Update quantity if product already exists in cart
async function updateCartItemQuantity(cartItemID, quantity, lineTotalBefore, lineTotalAfter) {
    await db.query(
        `UPDATE cart_items 
     SET quantity = ?, 
         lineTotalBefore = ?, 
         lineTotalAfter = ?, 
         updatedAt = NOW()
     WHERE cartItemID = ?`,
        [quantity, lineTotalBefore, lineTotalAfter, cartItemID]
    );
    const [updated] = await db.query(
        `SELECT * FROM cart_items WHERE cartItemID = ?`,
        [cartItemID]
    );
    return updated[0];
}

async function getCartItemWithVariation(cartID, productID, variationID) {
    const [rows] = await db.query(
        `SELECT * FROM cart_items 
         WHERE cartID = ? AND productID = ? AND variationID <=> ? 
         LIMIT 1`,
        [cartID, productID, variationID]
    );
    return rows[0] || null;
}
async function updateCartTotals(cartID) {
    // 1) sum of before/after
    const [sumRows] = await db.query(
        `SELECT
       COALESCE(ROUND(SUM(lineTotalBefore), 2), 0.00) AS subtotal,
       COALESCE(ROUND(SUM(lineTotalAfter), 2), 0.00) AS total
     FROM cart_items
     WHERE cartID = ?`,
        [cartID]
    );

    const subtotal = Number(sumRows[0].subtotal) || 0;
    const total = Number(sumRows[0].total) || 0;
    const totalDiscount = Number((subtotal - total).toFixed(2));

    // 2) anyModifications: any item where unitPriceBefore != unitPriceAfter (null-safe)
    const [modRows] = await db.query(
        `SELECT COUNT(*) AS cnt
     FROM cart_items
     WHERE cartID = ?
       AND NOT (unitPriceBefore <=> unitPriceAfter)`,
        [cartID]
    );
    const anyModifications = (modRows[0].cnt || 0) > 0;

    // 3) persist the cartDetail. We set modified = FALSE because a new/updated item means pricing must be re-applied.
    await db.query(
        `UPDATE cartDetail
     SET subtotal = ?, total = ?, totalDiscount = ?, anyModifications = ?, modified = FALSE, updatedAt = NOW()
     WHERE cartID = ?`,
        [subtotal, total, totalDiscount, anyModifications ? 1 : 0, cartID]
    );

    // 4) return updated cartDetail
    const [updatedCart] = await db.query(
        `SELECT * FROM cartDetail WHERE cartID = ? LIMIT 1`,
        [cartID]
    );
    return updatedCart[0] || null;
}

async function getCartModifiedFlag(uid) {
    const [rows] = await db.query(
        `SELECT modified FROM cartDetail WHERE uid = ? LIMIT 1`,
        [uid]
    );
    return rows[0]?.modified ?? null;
}

async function getCartItems(uid) {
    const query = `
        SELECT 
            ci.*,
            v.variationSlug AS variationName,
            v.variationValues,
            p.type AS productType
        FROM cart_items ci
        LEFT JOIN variations v ON ci.variationID = v.variationID
        LEFT JOIN products p ON ci.productID = p.productID
        WHERE ci.uid = ?
        ORDER BY ci.cartItemID ASC
    `;

    const [rows] = await db.query(query, [uid]);

    // Parse variationValues and custom_inputs if JSON
    return rows.map(item => ({
        ...item,
        variationValues: item.variationValues ? JSON.parse(item.variationValues) : [],
        custom_inputs: item.custom_inputs ? JSON.parse(item.custom_inputs) : null
    }));
}


async function getOfferByID(offerID) {
    const [rows] = await db.query(
        `SELECT * FROM offers WHERE offerID = ? LIMIT 1`,
        [offerID]
    );
    return rows[0] || null;
}

async function updateCartItems(items) {
    const queries = items.map(item =>
        db.query(
            `UPDATE cart_items 
       SET unitPriceAfter=?, lineTotalAfter=?, offerApplied=?, offerStatus=? 
       WHERE cartItemID=?`,
            [item.unitPriceAfter, item.lineTotalAfter, item.offerApplied ? 1 : 0, item.offerStatus, item.cartItemID]
        )
    );
    await Promise.all(queries);
}

async function updateCartDetail(uid, summary) {
    console.log(uid);

    const { subtotal, total, totalDiscount, anyModifications } = summary;
    await db.query(
        `UPDATE cartDetail 
     SET subtotal=?, total=?, totalDiscount=?, modified=1 
     WHERE uid=?`,
        [subtotal, total, totalDiscount, String(uid)]
    );
}

// Update referBy centrally on cartDetail
async function updateCartReferBy(uid, referBy) {
    await db.query(
        `UPDATE cartDetail SET referBy = ?, updatedAt = NOW() WHERE uid = ?`,
        [referBy || null, uid]
    );
}

async function getCartSummaryFromDB(uid) {
    const [rows] = await db.query(
        `SELECT subtotal, total, totalDiscount, modified 
     FROM cartDetail 
     WHERE uid = ? LIMIT 1`,
        [uid]
    );
    return rows[0] || null;
}

// Delete cart item
async function deleteCartItem(cartItemID) {
    await db.query("DELETE FROM cart_items WHERE cartItemID = ?", [cartItemID]);
}

async function getProductByIDCombo(productID) {
    const [rows] = await db.query(
        `SELECT productID, name, featuredImage, offerID, salePrice, regularPrice 
         FROM products WHERE productID = ?`,
        [productID]
    );
    return rows[0] || null;
}

async function getVariationByID(variationID) {
    const [rows] = await db.query(
        `SELECT * FROM variations WHERE variationID = ?`,
        [variationID]
    );
    return rows[0] || null;
}

async function getVariationByIDCombo(variationID) {
    const [rows] = await db.query(
        `SELECT variationID FROM variations WHERE variationID = ?`,
        [variationID]
    );
    return rows[0] || null;
}

async function insertCartItemCombo(item) {
    const [result] = await db.query(
        `INSERT INTO cart_items 
         (cartID, uid, productID, quantity, regularPrice, salePrice, overridePrice,
          unitPriceBefore, unitPriceAfter, lineTotalBefore, lineTotalAfter, offerID, name, featuredImage, comboID)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
            item.cartID, item.uid, item.productID, item.quantity,
            item.regularPrice, item.salePrice, item.overridePrice,
            item.unitPriceBefore, item.unitPriceAfter,
            item.lineTotalBefore, item.lineTotalAfter,
            item.offerID, item.name, item.featuredImage, item.comboID
        ]
    );
    return { ...item, cartItemID: result.insertId };
}

async function insertComboItemCombo(comboItem) {
    await db.query(
        `INSERT INTO order_combo_items 
         (comboID, productID, variationID, productName, featuredImage, variationName)
         VALUES (?,?,?,?,?,?)`,
        [
            comboItem.comboID, comboItem.productID, comboItem.variationID,
            comboItem.productName, comboItem.featuredImage, comboItem.variationName
        ]
    );
}

async function updateCartTotalsCombo(cartID) {
    // recalculate totals from cart_items
    const [rows] = await db.query(
        `SELECT SUM(lineTotalBefore) as totalBefore, SUM(lineTotalAfter) as totalAfter
         FROM cart_items WHERE cartID = ?`,
        [cartID]
    );
    const totals = rows[0] || { totalBefore: 0, totalAfter: 0 };
    await db.query(
        `UPDATE cart SET totalBefore = ?, totalAfter = ? WHERE cartID = ?`,
        [totals.totalBefore, totals.totalAfter, cartID]
    );
    return { cartID, ...totals };
}
async function getComboItems(comboID) {
    const query = `
        SELECT 
            oci.productID, 
            oci.variationID, 
            p.name, 
            p.featuredImage, 
            v.variationSlug AS variationName,
            v.variationValues
        FROM order_combo_items oci
        JOIN products p ON oci.productID = p.productID
        LEFT JOIN variations v ON oci.variationID = v.variationID
        WHERE oci.comboID = ?
    `;

    const [comboItems] = await db.query(query, [comboID]);

    // Parse JSON safely for each variationValues
    return comboItems.map(item => ({
        ...item,
        variationValues: item.variationValues ? JSON.parse(item.variationValues) : []
    }));
}

module.exports = {
    getProductByID,
    getOrCreateCart,
    getCartItem,
    getCartItemByID,
    insertCartItem,
    updateCartItemQuantity, updateCartTotals, getCartModifiedFlag,
    getCartItems,
    getOfferByID,
    updateCartItems,
    updateCartDetail,
    getCartSummaryFromDB, deleteCartItem, getProductByIDCombo,
    getVariationByID,
    getVariationByIDCombo,
    insertCartItemCombo,
    insertComboItemCombo, updateCartTotalsCombo, getComboItems, getCartItemWithVariation, updateCartReferBy

};
