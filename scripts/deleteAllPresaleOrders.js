const db = require('../utils/dbconnect');

// Function to delete all presale orders
async function deleteAllPresaleOrders() {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        console.log('Starting to delete all presale orders...\n');
        
        // First, get count of records to be deleted
        const [bookingCount] = await connection.query('SELECT COUNT(*) as total FROM presale_booking_details');
        const [itemCount] = await connection.query('SELECT COUNT(*) as total FROM presale_booking_items');
        
        console.log(`Found ${bookingCount[0].total} presale bookings`);
        console.log(`Found ${itemCount[0].total} presale booking items\n`);
        
        // Delete presale booking items first (due to foreign key constraints)
        const [itemResult] = await connection.query('DELETE FROM presale_booking_items');
        console.log(`✓ Deleted ${itemResult.affectedRows} presale booking items`);
        
        // Delete presale booking details
        const [bookingResult] = await connection.query('DELETE FROM presale_booking_details');
        console.log(`✓ Deleted ${bookingResult.affectedRows} presale booking details`);
        
        await connection.commit();
        
        console.log('\n========================================');
        console.log('Summary:');
        console.log(`  Deleted ${itemResult.affectedRows} presale booking items`);
        console.log(`  Deleted ${bookingResult.affectedRows} presale booking details`);
        console.log('========================================\n');
        
        console.log('All presale orders deleted successfully!');
        
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting presale orders:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// Run the script
if (require.main === module) {
    deleteAllPresaleOrders()
        .then(() => {
            console.log('Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { deleteAllPresaleOrders };

