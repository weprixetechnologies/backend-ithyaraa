const offerModel = require('../model/offersModel');
const { v4: uuidv4 } = require('uuid');

const generateUniqueOfferID = async () => {
    let unique = false;
    let offerID = '';

    while (!unique) {
        const suffix = uuidv4().split('-')[0].toUpperCase();
        offerID = `OFFERID-${suffix}`;

        const exists = await offerModel.doesOfferIDExist(offerID);
        if (!exists) unique = true;
    }

    return offerID;
};

const createOffer = async (offerData) => {
    if (!offerData.offerName) {
        throw new Error('Required field missing: offerName');
    }

    const offerID = offerData.offerID?.trim() || await generateUniqueOfferID();

    const productIDs = Array.isArray(offerData.products)
        ? offerData.products.map(p => typeof p === 'object' ? p.productID : p)
        : [];

    const payload = {
        ...offerData,
        offerID,
        products: JSON.stringify(productIDs), // Store in `products` column
    };

    const result = await offerModel.insertOffer(payload);

    // Update offerID in each selected product
    if (Array.isArray(offerData.products)) {
        for (const product of offerData.products) {
            const productID = typeof product === 'object' ? product.productID : product;
            await offerModel.updateProductOfferID(productID, offerID);
            console.log('Updated product:', productID);
        }
    }

    return {
        success: true,
        insertedId: offerID,
        dbResult: result
    };
};



const fetchFilteredOffers = async (query) => {
    const allowedFilters = [
        'offerID', 'offerName', 'offerType', 'buyAt',
        'buyCount', 'getCount'
    ];

    const likeFields = ['offerID', 'offerName', 'offerType'];

    const filters = [];
    const values = [];

    for (const key in query) {
        if (allowedFilters.includes(key)) {
            const val = query[key];
            if (likeFields.includes(key)) {
                filters.push(`${key} LIKE ?`);
                values.push(`%${val}%`);
            } else {
                filters.push(`${key} = ?`);
                values.push(val);
            }
        }
    }

    const result = await offerModel.getFilteredOffers(filters, values);

    return result;
};

const fetchOfferCount = async (query) => {
    const allowedFilters = [
        'offerID', 'offerName', 'offerType', 'buyAt',
        'buyCount', 'getCount'
    ];

    const likeFields = ['offerID', 'offerName', 'offerType'];

    const filters = [];
    const values = [];

    for (const key in query) {
        if (allowedFilters.includes(key)) {
            const val = query[key];
            if (likeFields.includes(key)) {
                filters.push(`${key} LIKE ?`);
                values.push(`%${val}%`);
            } else {
                filters.push(`${key} = ?`);
                values.push(val);
            }
        }
    }

    const count = await offerModel.getTotalOffers(filters, values);
    return count;
};


const updateOffer = async (offerID, updatedData) => {
    try {
        // Step 1: Update the offer in the DB
        const productIDs = Array.isArray(updatedData.products)
            ? updatedData.products.map(p => typeof p === 'object' ? p.productID : p)
            : [];

        const payload = {
            ...updatedData,
            products: JSON.stringify(productIDs), // Store in `products` column
        };

        const result = await offerModel.updateOfferByID(offerID, payload);

        // Step 2: Clear offerID from all products that previously had this offer
        await offerModel.clearOfferIDFromProducts(offerID);

        // Step 3: Assign offerID to new productIDs
        if (Array.isArray(updatedData.products)) {
            for (const product of updatedData.products) {
                await offerModel.updateProductOfferID(product, offerID);
            }
        }

        return {
            success: true,
            data: result,
        };
    } catch (error) {
        console.error('Error updating offer:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred while updating the offer',
        };
    }
};


const fetchOfferDetails = async (offerID) => {
    const offer = await offerModel.getOfferByID(offerID);

    if (!offer) {
        throw new Error('Offer not found');
    }

    return offer;
};

const deleteOffer = async (offerID) => {
    try {
        // Step 1: Clear offerID from all products that reference this offer
        await offerModel.clearOfferIDFromProducts(offerID);

        // Step 2: Delete the offer
        const result = await offerModel.deleteOffer(offerID);

        if (result.affectedRows === 0) {
            return {
                success: false,
                message: 'Offer not found'
            };
        }

        return {
            success: true,
            message: 'Offer deleted successfully',
            affectedRows: result.affectedRows
        };
    } catch (error) {
        console.error('Error deleting offer:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred while deleting the offer'
        };
    }
};

module.exports = { createOffer, fetchFilteredOffers, fetchOfferCount, updateOffer, fetchOfferDetails, deleteOffer };
