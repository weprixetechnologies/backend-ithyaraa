const db = require('./../utils/dbconnect')

// Fetch product details by productID
async function getProductByID(productID) {
    const [rows] = await db.query(
        `SELECT productID, featuredImage, regularPrice, salePrice, categories, brand 
     FROM products 
     WHERE productID = ? 
     LIMIT 1`,
        [productID]
    );
    return rows[0];
}

// Add item to wishlist
async function addToWishlist({ wishlistID, uid, product }) {
    const {
        productID,
        featuredImage,
        regularPrice,
        salePrice,
        categories,
        brand,
        slug
    } = product;

    await db.query(
        `INSERT INTO wishlist 
     (wishlistID, uid, productID, featuredImage, regularPrice, salePrice, categories, brand, slug) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            wishlistID,
            uid,
            productID,
            featuredImage,
            regularPrice,
            salePrice,
            categories,
            brand,
            slug
        ]
    );
}
async function removeFromWishlist(uid, productID) {
    const [result] = await db.query(
        `DELETE FROM wishlist WHERE uid = ? AND productID = ?`,
        [uid, productID]
    );
    return result.affectedRows; // will be 1 if deleted, 0 if not found
}
async function getWishlistByUID(uid) {
    const [rows] = await db.query(
        `SELECT wishlistID, productID, featuredImage, regularPrice, salePrice, categories, brand, slug
     FROM wishlist 
     WHERE uid = ?`,
        [uid]
    );
    return rows;
}

module.exports = {
    getProductByID, getWishlistByUID,
    addToWishlist, removeFromWishlist
};
