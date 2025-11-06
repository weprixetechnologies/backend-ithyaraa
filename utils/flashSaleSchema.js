const db = require('./dbconnect');

let cachedMapping = null;

async function detectFlashSaleSchema() {
    if (cachedMapping) return cachedMapping;
    const database = 'ithyaraa';

    const [detailCols] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'flash_sale_details'`,
        [database]
    );
    const [itemCols] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'flash_sale_items'`,
        [database]
    );

    const has = (arr, name) => arr.some(c => c.COLUMN_NAME === name);

    const m = {
        tables: {
            details: 'flash_sale_details',
            items: 'flash_sale_items',
        },
        details: {
            saleID: has(detailCols, 'saleID') ? 'saleID' : (has(detailCols, 'sale_id') ? 'sale_id' : 'saleID'),
            name: has(detailCols, 'name') ? 'name' : (has(detailCols, 'title') ? 'title' : 'name'),
            startTime: has(detailCols, 'startTime') ? 'startTime' : (has(detailCols, 'start_time') ? 'start_time' : null),
            endTime: has(detailCols, 'endTime') ? 'endTime' : (has(detailCols, 'end_time') ? 'end_time' : null),
            status: has(detailCols, 'status') ? 'status' : null,
            metadata: has(detailCols, 'metadata') ? 'metadata' : null,
            createdAt: has(detailCols, 'createdAt') ? 'createdAt' : (has(detailCols, 'created_at') ? 'created_at' : null),
            updatedAt: has(detailCols, 'updatedAt') ? 'updatedAt' : (has(detailCols, 'updated_at') ? 'updated_at' : null),
        },
        items: {
            saleID: has(itemCols, 'saleID') ? 'saleID' : (has(itemCols, 'sale_id') ? 'sale_id' : 'saleID'),
            productID: has(itemCols, 'productID') ? 'productID' : (has(itemCols, 'product_id') ? 'product_id' : 'productID'),
            saleItemID: has(itemCols, 'saleItemID') ? 'saleItemID' : (has(itemCols, 'sale_item_id') ? 'sale_item_id' : null),
            discountType: has(itemCols, 'discountType') ? 'discountType' : (has(itemCols, 'discount_type') ? 'discount_type' : null),
            discountValue: has(itemCols, 'discountValue') ? 'discountValue' : (has(itemCols, 'discount_value') ? 'discount_value' : null),
            id: has(itemCols, 'id') ? 'id' : null,
            createdAt: has(itemCols, 'createdAt') ? 'createdAt' : (has(itemCols, 'created_at') ? 'created_at' : null),
        }
    };

    cachedMapping = m;
    return m;
}

function getCachedFlashSaleSchema() {
    return cachedMapping;
}

module.exports = { detectFlashSaleSchema, getCachedFlashSaleSchema };


