const comboModel = require('../model/comboModel');
const crypto = require('crypto');
const productModel = require('../model/productModel');
const crossSellModel = require('../model/crossSellModel');
const { deepParse } = require('../utils/responseUtils');

const createComboProduct = async (payload) => {
    // Generate unique combo ID
    const comboID = "C" + crypto.randomBytes(4).toString("hex").toUpperCase();

    if (payload.type !== 'combo') {
        throw new Error('Product type must be combo');
    }

    // Force comboID and handle featuredImage JSON
    payload.productID = comboID;


    // Insert main product
    await comboModel.createProduct(payload);

    // Add selected products to combo_items table
    if (Array.isArray(payload.products) && payload.products.length > 0) {
        for (const productID of payload.products) {
            const productData = await comboModel.getProductByID(productID);
            if (productData) {
                await comboModel.addComboItem(comboID, {
                    comboID,
                    productID: productData.productID,
                    name: productData.name,
                    featuredImage: productData.featuredImage || null
                });
            }
        }
    }

    // Handle Cross-Sells (optional)
    const crossSells = payload.crossSells;
    if (Array.isArray(crossSells) && crossSells.length > 0) {
        try {
            await crossSellModel.deleteCrossSells(comboID);
            await crossSellModel.insertCrossSells(comboID, crossSells);
        } catch (err) {
            console.error('Error handling cross-sells for combo:', err);
            // Don't fail the entire request, just log the error
        }
    }

    return { comboID };
};

async function fetchComboWithProducts(comboID) {
    // Get combo main details
    const comboDetails = await comboModel.getComboDetails(comboID);
    if (!comboDetails) {
        const error = new Error(`Combo with ID '${comboID}' not found`);
        error.statusCode = 404;
        throw error;
    }

    // Get product IDs in combo
    const products = await comboModel.getComboItems(comboID);
    console.log(products);

    return {
        ...comboDetails,
        products
    };
}
async function fetchComboWithProductsUser(comboID) {
    // Get combo main details
    const comboDetails = await comboModel.getComboDetails(comboID);
    if (!comboDetails) {
        const error = new Error(`Combo with ID '${comboID}' not found`);
        error.statusCode = 404;
        throw error;
    }

    // Get product IDs in combo
    const productIDs = await comboModel.getComboItems(comboID);

    // Fetch each product's details along with variations
    const products = await Promise.all(productIDs.map(async (productID) => {
        const productData = await productModel.getProductWithVariations(productID);
        return productData;
    }));

    const response = {
        ...comboDetails,
        products
    };

    // Deep parse the response before sending
    return deepParse(response);
}

async function editComboProduct(productID, updateData, productIDs) {
    // 1. Update combo main product
    const affectedRows = await comboModel.updateComboProduct(productID, updateData);
    if (affectedRows === 0) {
        const error = new Error(`Combo with ID '${productID}' not found or no changes made`);
        error.statusCode = 404;
        throw error;
    }

    // 2. Remove old combo items
    await comboModel.deleteComboItems(productID);

    // 3. Add new combo items
    if (Array.isArray(productIDs) && productIDs.length > 0) {
        for (const id of productIDs) {
            const productData = await comboModel.getProductByID(id);
            if (productData) {
                console.log(`Adding product ${productData.productID} to combo ${productID}`);

                await comboModel.addComboItem(productID, {
                    productID: productData.productID,
                    name: productData.name,
                    featuredImage: productData.featuredImage || null
                });
            }
        }
    }

    // 4. Handle Cross-Sells (optional)
    if (updateData.hasOwnProperty('crossSells')) {
        const crossSells = updateData.crossSells;
        try {
            await crossSellModel.deleteCrossSells(productID);
            if (Array.isArray(crossSells) && crossSells.length > 0) {
                await crossSellModel.insertCrossSells(productID, crossSells);
            }
        } catch (err) {
            console.error('Error handling cross-sells for combo:', err);
            // Don't fail the entire request, just log the error
        }
    }

    return {
        message: "Combo updated successfully",
        productID,
        updatedFields: updateData,
        products: productIDs
    };
}

const deleteCombo = async (comboID) => {
    // Step 1: Delete the combo product itself
    await comboModel.deleteProductByID(comboID);

    // Step 2: Delete related combo items
    await comboModel.deleteComboItemsByComboID(comboID);

    return { message: 'Combo deleted successfully (skipped missing entries).' };
};

module.exports = {
    createComboProduct,
    fetchComboWithProducts,
    fetchComboWithProductsUser,
    editComboProduct,
    deleteCombo
};
