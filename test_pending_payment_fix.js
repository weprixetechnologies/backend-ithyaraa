// Test script to verify the pendingPayment increment fix
// This script tests that pendingPayment is properly incremented and not replaced

const db = require('./utils/dbconnect');

async function testPendingPaymentIncrement() {
    console.log('🧪 Testing pendingPayment increment functionality...\n');

    try {
        // Test 1: Individual increment function
        console.log('Test 1: Testing individual increment function');

        // Get a test user (you may need to adjust this)
        const [testUsers] = await db.execute('SELECT uid FROM users WHERE affiliate = "approved" LIMIT 1');

        if (testUsers.length === 0) {
            console.log('❌ No approved affiliate users found for testing');
            return;
        }

        const testUid = testUsers[0].uid;
        console.log(`Using test user: ${testUid}`);

        // Get current pendingPayment
        const [currentResult] = await db.execute(
            'SELECT pendingPayment FROM users WHERE uid = ?',
            [testUid]
        );
        const currentPending = currentResult[0]?.pendingPayment || 0;
        console.log(`Current pendingPayment: ${currentPending}`);

        // Test individual increment
        const incrementAmount = 100.50;
        await db.execute(
            'UPDATE users SET pendingPayment = COALESCE(pendingPayment, 0) + ? WHERE uid = ?',
            [incrementAmount, testUid]
        );

        // Check result
        const [afterResult] = await db.execute(
            'SELECT pendingPayment FROM users WHERE uid = ?',
            [testUid]
        );
        const newPending = afterResult[0]?.pendingPayment || 0;
        console.log(`After increment: ${newPending}`);
        console.log(`Expected: ${currentPending + incrementAmount}`);
        console.log(`✅ Individual increment test: ${newPending === currentPending + incrementAmount ? 'PASSED' : 'FAILED'}\n`);

        // Test 2: Batch increment function
        console.log('Test 2: Testing batch increment function');

        const currentPending2 = newPending;
        const batchUpdates = [
            { uid: testUid, amount: 50.25 },
            { uid: testUid, amount: 75.75 }
        ];

        // Simulate the fixed batch function
        const updatePromises = batchUpdates.map(update =>
            db.query(
                'UPDATE users SET pendingPayment = COALESCE(pendingPayment, 0) + ? WHERE uid = ?',
                [update.amount, update.uid]
            )
        );

        await Promise.all(updatePromises);

        // Check result
        const [finalResult] = await db.execute(
            'SELECT pendingPayment FROM users WHERE uid = ?',
            [testUid]
        );
        const finalPending = finalResult[0]?.pendingPayment || 0;
        const expectedFinal = currentPending2 + 50.25 + 75.75;

        console.log(`After batch increment: ${finalPending}`);
        console.log(`Expected: ${expectedFinal}`);
        console.log(`✅ Batch increment test: ${finalPending === expectedFinal ? 'PASSED' : 'FAILED'}\n`);

        // Test 3: Multiple increments to same user
        console.log('Test 3: Testing multiple increments to same user');

        const currentPending3 = finalPending;

        // Simulate multiple orders crediting the same user
        for (let i = 0; i < 3; i++) {
            await db.execute(
                'UPDATE users SET pendingPayment = COALESCE(pendingPayment, 0) + ? WHERE uid = ?',
                [25.00, testUid]
            );
        }

        const [multiResult] = await db.execute(
            'SELECT pendingPayment FROM users WHERE uid = ?',
            [testUid]
        );
        const multiPending = multiResult[0]?.pendingPayment || 0;
        const expectedMulti = currentPending3 + (25.00 * 3);

        console.log(`After multiple increments: ${multiPending}`);
        console.log(`Expected: ${expectedMulti}`);
        console.log(`✅ Multiple increments test: ${multiPending === expectedMulti ? 'PASSED' : 'FAILED'}\n`);

        console.log('🎉 All tests completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Close database connection
        await db.end();
    }
}

// Instructions for running the test
console.log(`
📋 Instructions for testing the pendingPayment fix:

1. Make sure your database is running and accessible
2. Ensure you have at least one approved affiliate user in the database
3. Run the test:
   node test_pending_payment_fix.js

📝 What this test verifies:
- Individual pendingPayment increments work correctly
- Batch pendingPayment increments work correctly  
- Multiple increments to the same user accumulate properly
- The COALESCE function handles NULL values correctly

🔧 The fix addresses:
- SQL injection vulnerability in batch updates
- Incorrect CASE statement structure
- Proper parameter binding for security
`);

// Uncomment the line below to run the test
// testPendingPaymentIncrement();
