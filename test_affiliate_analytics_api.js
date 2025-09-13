// Test script for the affiliate analytics API
// Run this after starting the backend server

const axios = require('axios');

// API endpoint (adjust the base URL as needed)
const API_BASE_URL = 'http://localhost:3000'; // Adjust port as needed

async function testAffiliateAnalytics() {
    try {
        console.log('Testing /api/affiliate/analytics API...');

        // Note: You'll need to include proper authentication headers
        // This is just a demonstration of the API call structure
        const response = await axios.get(`${API_BASE_URL}/api/affiliate/analytics`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_ACCESS_TOKEN_HERE' // Replace with actual token
            }
        });

        console.log('Response:', response.data);
        console.log('✅ Analytics API call successful!');

        // Verify the response structure
        const { success, data } = response.data;
        if (success && data) {
            console.log('📊 Analytics Data:');
            console.log(`- Total Clicks: ${data.totalClicks}`);
            console.log(`- Total Orders: ${data.totalOrders}`);
            console.log(`- Total Earnings: ${data.totalEarnings}`);
            console.log(`- Pending Earnings: ${data.totalPendingEarnings}`);
        }

    } catch (error) {
        console.error('❌ Analytics API call failed:', error.response?.data || error.message);
    }
}

// Instructions for running the test
console.log(`
📋 Instructions for testing the affiliate analytics API:

1. Start your backend server:
   npm start

2. Get a valid access token from your authentication system for an affiliate user

3. Update the API_BASE_URL and Authorization header in this script

4. Run the test:
   node test_affiliate_analytics_api.js

📝 Expected behavior:
- The API should return analytics data for the authenticated affiliate user
- Response should include:
  - totalClicks: sum of cart_items + order_items where referBy = user.uid
  - totalOrders: count of order_items where referBy = user.uid
  - totalEarnings: 10% commission of lineTotalAfter for order_items where referBy = user.uid
  - totalPendingEarnings: 10% commission of lineTotalAfter for order_items where referBy = user.uid AND orderStatus != 'delivered'

🔗 API Endpoint: GET /api/affiliate/analytics
🔐 Authentication: Required (Bearer token)
`);

// Uncomment the line below to run the test
// testAffiliateAnalytics();
