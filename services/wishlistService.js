const { v4: uuidv4 } = require('uuid');
const wishlistModel = require('../model/wishlistModel');

async function addWishlist(uid, productID) {
    // 1. Fetch product details
    const product = await wishlistModel.getProductByID(productID);
    if (!product) {
        throw new Error('Product not found');
    }
    console.log(product);

    // 2. Generate wishlistID
    const wishlistID = uuidv4();

    // 3. Insert into wishlist
    await wishlistModel.addToWishlist({ wishlistID, uid, product });
    return {
        wishlistID,
        ...product,
        featuredImage: JSON.parse(product.featuredImage),
        categories: product.categories ? JSON.parse(product.categories) : null
    };
}
async function removeWishlist(uid, productID) {
    const affected = await wishlistModel.removeFromWishlist(uid, productID);

    if (affected === 0) {
        throw new Error('Product not found in wishlist');
    }

    return { productID };
}

async function getWishlist(uid) {
    const items = await wishlistModel.getWishlistByUID(uid);

    // Parse JSON fields before returning
    const parsed = items.map(item => ({
        ...item,
        featuredImage: typeof item.featuredImage === 'string'
            ? JSON.parse(item.featuredImage)
            : item.featuredImage,
        categories: item.categories
            ? (typeof item.categories === 'string'
                ? JSON.parse(item.categories)
                : item.categories)
            : null
    }));

    return parsed;
}
module.exports = {
    addWishlist, removeWishlist, getWishlist
};
