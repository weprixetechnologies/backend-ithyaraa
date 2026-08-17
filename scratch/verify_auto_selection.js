const axios = require('axios');
const db = require('../utils/dbconnect');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2MThJMlZLQSIsInVzZXJuYW1lIjoicm9uaXRzYXJrYXJfMDEiLCJlbWFpbElEIjoicm9uaXRzYXJrYXIuZGV2QGdtYWlsLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3ODAyMDYyMCwiZXhwIjoxNzc4NjI1NDIwfQ.XRwWW4ap6BBgwgvuzg6JpvqlCB4sERHXGUJr-FE5ySY';
const BASE_URL = 'https://backend.ithyaraa.com/api/cart'; // Adjust port if needed

const testProductID = 'ITHYP4c8SB';
const testVariationID = 'VAR-P25SQFL';
const testUID = '618I2VKA';

async function verify() {
    console.log('--- Starting Verification ---');

    try {
        // 1. Add item to cart
        console.log('1. Adding item to cart...');
        const addRes = await axios.post(`${BASE_URL}/add-cart`, {
            productID: testProductID,
            variationID: testVariationID,
            quantity: 10
        }, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });

        const cartItemID = addRes.data.cartItem.cartItemID;
        console.log(`Item added. CartItemID: ${cartItemID}`);

        // 2. Set stock to 5 (Low Stock)
        console.log('2. Setting variation stock to 5 (Low Stock)...');
        await db.query('UPDATE variations SET variationStock = 5 WHERE variationID = ?', [testVariationID]);

        // 3. Call Auto Update API
        console.log('3. Calling /auto-update-selection...');
        const updateRes = await axios.post(`${BASE_URL}/auto-update-selection`, {}, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });

        console.log('API Response:', JSON.stringify(updateRes.data, null, 2));

        // 4. Verify in DB
        console.log('4. Verifying item is unselected in DB...');
        const [rows] = await db.query('SELECT selected FROM cart_items WHERE cartItemID = ?', [cartItemID]);
        if (rows[0].selected === 0) {
            console.log('SUCCESS: Item was correctly unselected.');
        } else {
            console.error('FAILURE: Item is still selected!');
        }

        // 6. Verify getCart response has stockStatus and isAvailable
        console.log('6. Verifying getCart response for stock fields...');
        const cartRes = await axios.post(`${BASE_URL}/get-cart`, {}, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });

        const testItem = cartRes.data.items.find(i => i.cartItemID === cartItemID);
        if (testItem && testItem.stockStatus && testItem.isAvailable !== undefined) {
            console.log(`SUCCESS: Found stock fields. Status: ${testItem.stockStatus}, Available: ${testItem.isAvailable}`);
        } else {
            console.error('FAILURE: Stock fields missing or incorrect in getCart response.');
            console.log('Sample item:', JSON.stringify(testItem, null, 2));
        }

        // 7. Restore stock for safety
        console.log('7. Restoring variation stock to 195...');
        await db.query('UPDATE variations SET variationStock = 195 WHERE variationID = ?', [testVariationID]);

        console.log('--- Verification Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

verify();
