const axios = require('axios');

// Test script for payout history API
const BASE_URL = 'http://localhost:5000/api/affiliate';

// You'll need to replace this with a valid token
const TEST_TOKEN = 'your_test_token_here';

async function testPayoutHistoryAPI() {
    try {
        console.log('🧪 Testing Payout History API...\n');

        // Test 1: Get payout history
        console.log('1. Testing GET /payout-history');
        const historyResponse = await axios.get(`${BASE_URL}/payout-history`, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`
            }
        });

        console.log('✅ Payout History Response:');
        console.log('Status:', historyResponse.status);
        console.log('Success:', historyResponse.data?.success);
        console.log('Data:', JSON.stringify(historyResponse.data?.data, null, 2));

        if (historyResponse.data?.data && historyResponse.data.data.length > 0) {
            console.log('\n📊 Payout History Summary:');
            historyResponse.data.data.forEach((payout, index) => {
                console.log(`${index + 1}. Amount: ₹${payout.amount} | Status: ${payout.status} | Date: ${payout.date}`);
            });
        } else {
            console.log('\n📝 No payout history found (this is normal for new users)');
        }

    } catch (error) {
        console.error('❌ Error testing payout history API:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Instructions for running the test
console.log('📋 Instructions:');
console.log('1. Make sure your backend server is running on port 5000');
console.log('2. Replace TEST_TOKEN with a valid JWT token from an approved affiliate user');
console.log('3. Run: node test_payout_history_api.js');
console.log('4. The API should return payout history for transactions with type="outgoing"\n');

// Uncomment the line below to run the test
// testPayoutHistoryAPI();

module.exports = { testPayoutHistoryAPI };
