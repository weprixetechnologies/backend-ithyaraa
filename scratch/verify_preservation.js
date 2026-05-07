const productServices = require('../services/productServices');
const db = require('../utils/dbconnect');

async function verifyFullFlow() {
    const productID = 'ITHYP4agcW';
    console.log(`Verifying FULL flow preservation for product: ${productID}`);

    try {
        // 1. Get IDs before
        const [before] = await db.query('SELECT variationID, variationSlug FROM variations WHERE productID = ? ORDER BY variationID', [productID]);
        const beforeIDs = before.map(v => v.variationID);
        console.log("IDs Before:", beforeIDs);

        // 2. Full Flow simulation
        const mockAttributes = [{ name: 'size', values: ['S', 'M', 'L'] }];
        const mockVariations = before.map(v => ({
            variationID: v.variationID,
            variationSlug: v.variationSlug,
            variationStock: 77 // new change
        }));

        console.log("Step 1: Calling editAttributeService...");
        await productServices.editAttributeService(mockAttributes, productID);

        console.log("Step 2: Calling editVariationMap...");
        await productServices.editVariationMap({ variations: mockVariations, productID });

        // 3. Get IDs after
        const [after] = await db.query('SELECT variationID, variationSlug FROM variations WHERE productID = ? ORDER BY variationID', [productID]);
        const afterIDs = after.map(v => v.variationID);
        console.log("IDs After: ", afterIDs);

        const preserved = JSON.stringify(beforeIDs) === JSON.stringify(afterIDs);
        if (preserved) {
            console.log("SUCCESS: FULL FLOW preserved Variation IDs!");
        } else {
            console.log("FAILURE: FULL FLOW changed Variation IDs!");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

verifyFullFlow();
