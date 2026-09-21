const db = require('../utils/dbconnect');

async function fixComboBrands() {
    try {
        console.log('Starting fix for combo and make_combo products brand/brandID...');

        const [result] = await db.query(`
            UPDATE products
            SET 
                brandID = COALESCE(NULLIF(brandID, ''), 'inhouse'),
                brand = COALESCE(NULLIF(brand, ''), 'In-house Brand')
            WHERE 
                (type IN ('combo', 'make_combo') OR brandID IS NULL OR brandID = '' OR LOWER(brandID) = 'inhouse')
                AND (brandID IS NULL OR brand IS NULL OR brandID = '' OR brand = '')
        `);

        console.log(`Successfully updated ${result.affectedRows} products.`);

        // Also normalize order_items for combos
        const [orderResult] = await db.query(`
            UPDATE order_items
            SET brandID = 'inhouse'
            WHERE (brandID IS NULL OR brandID = '' OR LOWER(brandID) = 'inhouse')
        `);

        console.log(`Successfully updated ${orderResult.affectedRows} order_items.`);
    } catch (error) {
        console.error('Error fixing combo brands:', error);
    } finally {
        process.exit();
    }
}

fixComboBrands();
