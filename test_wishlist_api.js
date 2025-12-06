const axios = require('axios');

// Test configuration
const BASE_URL = 'http://72.60.219.181:3002/api/wishlist';
const TEST_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual JWT token

// Test data
const testProduct = {
    productID: 'ITHYP12345' // Replace with actual product ID
};

// Helper function to make authenticated requests
const makeRequest = async (method, endpoint, data = null) => {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`Error in ${method} ${endpoint}:`, error.response?.data || error.message);
        return null;
    }
};

// Test functions
const testAddToWishlist = async () => {
    console.log('\n🧪 Testing Add to Wishlist...');
    const result = await makeRequest('POST', '/add', testProduct);

    if (result) {
        console.log('✅ Add to Wishlist Response:', result);
    } else {
        console.log('❌ Add to Wishlist Failed');
    }

    return result;
};

const testGetWishlist = async () => {
    console.log('\n🧪 Testing Get Wishlist...');
    const result = await makeRequest('GET', '/');

    if (result) {
        console.log('✅ Get Wishlist Response:', result);
    } else {
        console.log('❌ Get Wishlist Failed');
    }

    return result;
};

const testCheckWishlist = async (productID) => {
    console.log('\n🧪 Testing Check Wishlist...');
    const result = await makeRequest('GET', `/check/${productID}`);

    if (result) {
        console.log('✅ Check Wishlist Response:', result);
    } else {
        console.log('❌ Check Wishlist Failed');
    }

    return result;
};

const testRemoveFromWishlist = async (wishlistItemID) => {
    console.log('\n🧪 Testing Remove from Wishlist...');
    const result = await makeRequest('DELETE', `/remove/${wishlistItemID}`);

    if (result) {
        console.log('✅ Remove from Wishlist Response:', result);
    } else {
        console.log('❌ Remove from Wishlist Failed');
    }

    return result;
};

const testRemoveByProductID = async (productID) => {
    console.log('\n🧪 Testing Remove by Product ID...');
    const result = await makeRequest('DELETE', `/remove-product/${productID}`);

    if (result) {
        console.log('✅ Remove by Product ID Response:', result);
    } else {
        console.log('❌ Remove by Product ID Failed');
    }

    return result;
};

// Main test function
const runTests = async () => {
    console.log('🚀 Starting Wishlist API Tests...');
    console.log('⚠️  Make sure to replace TEST_TOKEN with a valid JWT token');
    console.log('⚠️  Make sure to replace productID with a valid product ID');
    console.log('⚠️  Make sure the server is running on port 3000');
    console.log('⚠️  Product type will be automatically fetched from database');

    // Test 1: Add to wishlist
    const addResult = await testAddToWishlist();

    if (addResult && addResult.success) {
        // Test 2: Get wishlist
        await testGetWishlist();

        // Test 3: Check if product is in wishlist
        await testCheckWishlist(testProduct.productID);

        // Test 4: Remove from wishlist by productID
        await testRemoveByProductID(testProduct.productID);

        // Test 5: Remove from wishlist (if we have wishlistItemID) - alternative method
        if (addResult.data && addResult.data.wishlistItemID) {
            await testRemoveFromWishlist(addResult.data.wishlistItemID);
        }
    }

    console.log('\n✨ Tests completed!');
};

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    testAddToWishlist,
    testGetWishlist,
    testCheckWishlist,
    testRemoveFromWishlist,
    testRemoveByProductID,
    runTests
};
