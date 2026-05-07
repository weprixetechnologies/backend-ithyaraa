const db = require('../utils/dbconnect');

async function checkItem217() {
    const cartItemID = 217;
    console.log(`--- Checking CartItemID: ${cartItemID} ---`);

    try {
        // 1. Get the cart item with basic product info
        const [items] = await db.query(`
            SELECT ci.*, p.type as productType, p.status as productStatus, v.variationStock
            FROM cart_items ci
            JOIN products p ON ci.productID = p.productID
            LEFT JOIN variations v ON ci.variationID = v.variationID
            WHERE ci.cartItemID = ?
        `, [cartItemID]);

        if (items.length === 0) {
            console.log("Error: Item 217 not found in cart_items table.");
            process.exit(1);
        }

        const item = items[0];
        console.log(`Product Name: ${item.name}`);
        console.log(`Product Type: ${item.productType}`);
        console.log(`Requested Quantity: ${item.quantity}`);
        console.log(`Base Product Status: ${item.productStatus}`);

        if (item.productType === 'customproduct') {
            console.log("Result: CUSTOM PRODUCT (Always IN_STOCK)");
            process.exit(0);
        }

        if (item.productType === 'combo') {
            console.log("Checking Combo Children...");
            const [children] = await db.query(`
                SELECT oci.*, p.status as productStatus, v.variationStock
                FROM order_combo_items oci
                JOIN products p ON oci.productID = p.productID
                LEFT JOIN variations v ON oci.variationID = v.variationID
                WHERE oci.comboID = ?
            `, [item.comboID]);

            let isOut = false;
            let minStock = Infinity;

            children.forEach(child => {
                const childOut = child.productStatus === 'Out of Stock' || (child.variationID && (child.variationStock === null || child.variationStock <= 0));
                console.log(` - Child ${child.productID}: Status=${child.productStatus}, Stock=${child.variationStock} ${childOut ? '[OUT]' : ''}`);
                
                if (childOut) isOut = true;
                if (child.variationID && child.variationStock < item.quantity) {
                    minStock = Math.min(minStock, child.variationStock);
                }
            });

            if (isOut) {
                console.log("Final Status: OUT_OF_STOCK (One or more children are unavailable)");
            } else if (minStock < item.quantity) {
                console.log(`Final Status: LOW_STOCK (Limiting Stock: ${minStock})`);
            } else {
                console.log("Final Status: IN_STOCK");
            }

        } else if (item.productType === 'variable') {
            console.log(`Variation ID: ${item.variationID}`);
            console.log(`Variation Stock: ${item.variationStock}`);

            if (item.variationStock === null || item.variationStock <= 0) {
                console.log("Final Status: OUT_OF_STOCK (Zero or NULL stock)");
            } else if (item.variationStock < item.quantity) {
                console.log(`Final Status: LOW_STOCK (Only ${item.variationStock} available for requested ${item.quantity})`);
            } else {
                console.log("Final Status: IN_STOCK");
            }
        } else {
            if (item.productStatus === 'Out of Stock') {
                console.log("Final Status: OUT_OF_STOCK (Base product is out of stock)");
            } else {
                console.log("Final Status: IN_STOCK");
            }
        }

        process.exit(0);
    } catch (error) {
        console.error("Database Error:", error);
        process.exit(1);
    }
}

checkItem217();
