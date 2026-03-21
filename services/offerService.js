const offerModel = require('../model/offersModel');
const { v4: uuidv4 } = require('uuid');
const { deleteCache, getCache, setCache } = require('../utils/cacheHelper');
const { SCOPE } = require('../utils/cacheScopes');
const db = require('../utils/dbconnect');

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

    // Invalidate offer cache
    try {
        await deleteCache(SCOPE.OFFER_ACTIVE(offerID));
        await deleteCache(SCOPE.OFFERS_LIST);
    } catch (err) {
        console.error('createOffer cache delete error', err);
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

        // Invalidate offer cache
        try {
            await deleteCache(SCOPE.OFFER_ACTIVE(offerID));
            await deleteCache(SCOPE.OFFERS_LIST);
        } catch (err) {
            console.error('updateOffer cache delete error', err);
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

        // Invalidate offer cache
        try {
            await deleteCache(SCOPE.OFFER_ACTIVE(offerID));
            await deleteCache(SCOPE.OFFERS_LIST);
        } catch (err) {
            console.error('deleteOffer cache delete error', err);
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

const fetchActiveOffersWithProducts = async () => {
    // 1️⃣ check cache
    const cacheKey = SCOPE.OFFERS_LIST;
    const cached = await getCache(cacheKey);
    if (cached) {
        return cached;
    }

    // 2️⃣ Fetch all offers
    const [offers] = await db.query(`
        SELECT offerID, offerName, offerType, buyAt, buyCount, getCount, offerMobileBanner, offerBanner
        FROM offers
        ORDER BY createdAt DESC
    `);

    // 3️⃣ For each offer, fetch up to 10 latest products
    for (let offer of offers) {
        const [products] = await db.query(`
            SELECT productID, name, regularPrice, salePrice,
                   discountType, discountValue, type, status,
                   brand, featuredImage, categories, sectionid, createdAt
            FROM products
            WHERE offerID = ? AND (status = 'In Stock' OR status IS NULL)
            ORDER BY createdAt DESC
            LIMIT 10
        `, [offer.offerID]);

        // Parse JSON fields
        products.forEach(row => {
            try {
                if (typeof row.featuredImage === 'string') {
                    row.featuredImage = JSON.parse(row.featuredImage);
                }
                if (typeof row.categories === 'string') {
                    row.categories = JSON.parse(row.categories);
                }
            } catch (e) {
                console.error('JSON parse error for product:', row.productID, e);
            }
        });

        offer.products = products;
    }

    const data = {
        success: true,
        data: offers
    };

    // Save cache
    await setCache(cacheKey, data, 300); // 5 minutes TTL

    return data;
};

module.exports = { createOffer, fetchFilteredOffers, fetchOfferCount, updateOffer, fetchOfferDetails, deleteOffer, fetchActiveOffersWithProducts };
