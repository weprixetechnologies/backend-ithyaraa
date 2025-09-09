// Test script for the modified /cart/add-cart API with referBy parameter
// Run this after applying the database migration

const axios = require('axios');

// Test data
const testData = {
    productID: 'PROD123',
    quantity: 2,
    variationID: 'VAR456',
    variationName: 'Size: Large',
    referBy: 'AFFILIATE789' // This is the new referBy parameter
};

// API endpoint (adjust the base URL as needed)
const API_BASE_URL = 'http://localhost:3000'; // Adjust port as needed

async function testAddCartWithReferBy() {
    try {
        console.log('Testing /cart/add-cart API with referBy parameter...');
        console.log('Request data:', testData);

        // Note: You'll need to include proper authentication headers
        // This is just a demonstration of the API call structure
        const response = await axios.post(`${API_BASE_URL}/cart/add-cart`, testData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_ACCESS_TOKEN_HERE' // Replace with actual token
            }
        });

        console.log('Response:', response.data);
        console.log('✅ API call successful!');

    } catch (error) {
        console.error('❌ API call failed:', error.response?.data || error.message);
    }
}

// Instructions for running the test
console.log(`
📋 Instructions for testing the modified API:

1. First, run the database migration:
   mysql -u your_username -p your_database < migrations/add_referby_to_cart_items.sql

2. Start your backend server:
   npm start

3. Get a valid access token from your authentication system

4. Update the API_BASE_URL and Authorization header in this script

5. Run the test:
   node test_cart_api.js

📝 Expected behavior:
- The API should accept the referBy parameter
- The referBy value should be stored in the cart_items table
- The response should include the created cart item with referBy field
`);

// Uncomment the line below to run the test
// testAddCartWithReferBy();
