const db = require('../utils/dbconnect');
const { getCache, setCache } = require('../utils/cacheHelper');
const { SCOPE } = require('../utils/cacheScopes');

async function getActiveFlashForProduct(productID) {
    if (!productID) return null;

    const cacheKey = SCOPE.FLASH_ACTIVE(productID);

    // Try cache first
    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            return cached;
        }
    } catch (err) {
        console.error('flashSale cache get error', err);
        // fall through to DB
    }

    const [rows] = await db.query(
        `SELECT i.discountType AS discountType, i.discountValue AS discountValue
         FROM flash_sale_items i
         JOIN flash_sale_details d ON d.saleID = i.saleID
         WHERE i.productID = ? AND d.status = 'active' AND NOW() BETWEEN d.startTime AND d.endTime
         LIMIT 1`,
        [productID]
    );
    const flash = (rows && rows.length > 0) ? rows[0] : null;

    if (flash) {
        try {
            // Short TTL – flash sales can change frequently
            await setCache(cacheKey, flash, 60);
        } catch (err) {
            console.error('flashSale cache set error', err);
        }
    }

    return flash;
}

module.exports = { getActiveFlashForProduct };


