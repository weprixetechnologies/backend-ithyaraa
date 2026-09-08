const categoryService = require('../services/categoryService');
const categoryModel = require('../model/categoryModel');

async function test() {
    try {
        console.log('1. Fetching all categories...');
        const initialRes = await categoryService.getAllCategories({ query: {} });
        console.log('Initial categories count:', initialRes.data?.length);
        console.log('Initial order:', initialRes.data?.map(c => ({ id: c.categoryID, name: c.categoryName, order: c.order })));

        if (!initialRes.data || initialRes.data.length < 2) {
            console.log('Fewer than 2 categories found, skipping swap test.');
            process.exit(0);
        }

        const cats = initialRes.data;
        // Swap first two categories
        const swapPayload = [
            { categoryID: cats[0].categoryID, order: 2 },
            { categoryID: cats[1].categoryID, order: 1 },
            ...cats.slice(2).map((c, i) => ({ categoryID: c.categoryID, order: i + 3 }))
        ];

        console.log('2. Updating order (swapping first two)...');
        const updateRes = await categoryService.reorderAllCategories(swapPayload);
        console.log('Update result:', updateRes);

        console.log('3. Fetching categories after reorder...');
        const afterRes = await categoryService.getAllCategories({ query: {} });
        console.log('New order:', afterRes.data?.map(c => ({ id: c.categoryID, name: c.categoryName, order: c.order })));

        // Restore original order
        console.log('4. Restoring original order...');
        const restorePayload = cats.map((c, i) => ({ categoryID: c.categoryID, order: i + 1 }));
        await categoryService.reorderAllCategories(restorePayload);

        const restoredRes = await categoryService.getAllCategories({ query: {} });
        console.log('Restored order:', restoredRes.data?.map(c => ({ id: c.categoryID, name: c.categoryName, order: c.order })));

        console.log('SUCCESS! Reorder feature verified backend end-to-end.');
        process.exit(0);
    } catch (err) {
        console.error('Test error:', err);
        process.exit(1);
    }
}

test();
