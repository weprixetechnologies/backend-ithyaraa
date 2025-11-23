const makeComboModel = require('./../model/makeCombo')
const crossSellModel = require('../model/crossSellModel');
const crypto = require('crypto');

const generateUniqueComboID = async () => {
    let uniqueID;
    let exists = true;

    while (exists) {
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        uniqueID = `ITHY_${random}_MCOMBO`;

        const found = await makeComboModel.getProductByID(uniqueID);
        if (!found) exists = false;
    }

    return uniqueID;
};

const createCombo = async (data) => {
    const { products, ...comboData } = data;
    console.log('data', products);

    // 1. Generate unique comboID
    const comboID = await generateUniqueComboID();

    // 2. Insert main combo as a product
    const productToInsert = {
        ...comboData,
        productID: comboID,
    };

    await makeComboModel.insertProduct(productToInsert);

    // 3. Loop through and insert combo items


    for (const item of products) {
        console.log(item);

        const product = await makeComboModel.getProductByID(item);
        if (!product) continue;

        const comboItemData = {
            comboID,
            productID: product.productID,
            productName: product.name,
            featuredImage: product.featuredImage,
            categories: product.categories,
        };

        await makeComboModel.insertComboItem(comboItemData);
    }

    // 4. Handle Cross-Sells (optional)
    const crossSells = data.crossSells;
    if (Array.isArray(crossSells) && crossSells.length > 0) {
        try {
            await crossSellModel.deleteCrossSells(comboID);
            await crossSellModel.insertCrossSells(comboID, crossSells);
        } catch (err) {
            console.error('Error handling cross-sells for make-combo:', err);
            // Don't fail the entire request, just log the error
        }
    }

    return { comboID };
};
const getComboDetails = async (comboID) => {
    const mainProduct = await makeComboModel.getMainComboProduct(comboID);
    if (!mainProduct) {
        return null;
    }

    const productIDs = await makeComboModel.getComboItemProductIDs(comboID);

    return {
        ...mainProduct,
        products: productIDs,
    };
};

const getComboDetailsForUser = async (comboID) => {
    const comboDetails = await makeComboModel.getComboDetailsWithProducts(comboID);
    if (!comboDetails) {
        return null;
    }

    // Parse JSON fields for the main combo product
    const jsonFields = ['featuredImage', 'galleryImage', 'categories', 'productAttributes'];
    jsonFields.forEach(field => {
        if (comboDetails[field]) {
            try {
                comboDetails[field] = JSON.parse(comboDetails[field]);
            } catch (e) {
                console.warn(`Failed to parse ${field} for combo ${comboID}:`, e.message);
            }
        }
    });

    return comboDetails;
};
const updateComboProduct = async (productID, updateData) => {
    const { products, ...productInfo } = updateData;

    // 1. Update main product
    await makeComboModel.updateProduct(productID, productInfo);

    // 2. Delete old combo items
    await makeComboModel.deleteComboItems(productID);

    // 3. Re-insert combo items with enriched data
    if (Array.isArray(products) && products.length > 0) {
        for (const prodID of products) {
            const product = await makeComboModel.getProductByID(prodID);

            if (product) {
                const item = {
                    productID: product.productID,
                    productName: product.name,
                    featuredImage: product.featuredImage,
                    categories: product.categoryName || [],
                    comboID: productID,
                };
                await makeComboModel.insertComboItem(item);
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
            console.error('Error handling cross-sells for make-combo:', err);
            // Don't fail the entire request, just log the error
        }
    }
};

module.exports = { createCombo, getComboDetails, getComboDetailsForUser, updateComboProduct };
