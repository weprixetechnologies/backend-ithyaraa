const db = require('../utils/dbconnect');

async function normalizeBrands() {
    try {
        console.log('Starting brandID normalization script...');

        const [prodResult] = await db.query(`
            UPDATE products 
            SET brandID = 'inhouse' 
            WHERE brandID IS NULL OR LOWER(brandID) IN ('inhouse', 'in-house', 'admin', '')
        `);
        console.log(`Updated products table: ${prodResult.affectedRows} rows modified.`);

        const [orderItemsResult] = await db.query(`
            UPDATE order_items 
            SET brandID = 'inhouse' 
            WHERE brandID IS NULL OR LOWER(brandID) IN ('inhouse', 'in-house', 'admin', '')
        `);
        console.log(`Updated order_items table: ${orderItemsResult.affectedRows} rows modified.`);

        console.log('brandID normalization completed successfully.');
    } catch (error) {
        console.error('Error normalizing brand IDs:', error);
    } finally {
        process.exit();
    }
}

normalizeBrands();
