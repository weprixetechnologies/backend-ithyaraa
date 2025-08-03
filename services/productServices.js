const generateRandomID = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 5; i++) {
        id += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `ITHYP${id}`;
};

const generateUniqueProductID = async () => {
    let unique = false;
    let productID = '';

    while (!unique) {
        productID = generateRandomID();

        const [rows] = await db.query(
            'SELECT 1 FROM products WHERE productID = ? LIMIT 1',
            [productID]
        );

        if (rows.length === 0) {
            unique = true;
        }
    }

    return productID;
};

const uploadVariationMap = async ({ variations, productID }) => {
    if (!variations) {
        return {
            success: false,
            message: 'No variation data provided'
        };
    }

    try {
        const results = [];

        if (Array.isArray(variations)) {
            for (const variation of variations) {
                const result = await uploadVariations({ ...variation, productID });
                if (!result.success) {
                    return {
                        success: false,
                        message: 'One or more variations failed to upload',
                        error: result.error
                    };
                }
                results.push(result);
            }
        } else if (typeof variations === 'object') {
            const result = await uploadVariations({ ...variations, productID });
            if (!result.success) {
                return {
                    success: false,
                    message: 'Variation upload failed',
                    error: result.error
                };
            }
            results.push(result);
        }

        return {
            success: true,
            message: 'Variation(s) uploaded successfully',
            data: results
        };
    } catch (error) {
        console.error('uploadVariationMap error:', error);
        return {
            success: false,
            message: 'Unexpected error during variation upload',
            error: error.message
        };
    }
};


module.exports = { generateUniqueProductID, uploadVariationMap };