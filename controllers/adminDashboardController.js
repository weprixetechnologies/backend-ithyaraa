const db = require('../utils/dbconnect');

// Get dashboard stats
const getDashboardStatsController = async (req, res) => {
    try {
        console.log('Fetching dashboard stats...');

        // Total users
        const [usersCount] = await db.query(
            `SELECT COUNT(*) as count FROM users WHERE role = 'user'`
        );

        // Total orders
        const [ordersCount] = await db.query(
            `SELECT COUNT(DISTINCT orderID) as count FROM orderDetail`
        );

        // Total revenue (excluding cancelled orders)
        const [revenueResult] = await db.query(
            `SELECT COALESCE(SUM(total), 0) as total 
             FROM orderDetail 
             WHERE paymentStatus = 'successful' 
             AND orderStatus != 'Cancelled'`
        );

        // Total products
        const [productsCount] = await db.query(
            `SELECT COUNT(*) as count FROM products`
        );

        console.log('Basic stats fetched');

        // Recent orders (last 10)
        const [recentOrders] = await db.query(
            `SELECT od.orderID, od.uid, od.total as totalAmount, od.orderStatus, od.paymentStatus, od.createdAt,
                    u.username
             FROM orderDetail od
             LEFT JOIN users u ON od.uid = u.uid COLLATE utf8mb4_unicode_ci
             ORDER BY od.createdAt DESC
             LIMIT 10`
        );

        // Recent users (last 10)
        const [recentUsers] = await db.query(
            `SELECT uid, username, emailID, createdOn as createdAt, verifiedEmail
             FROM users
             WHERE role = 'user'
             ORDER BY createdOn DESC
             LIMIT 10`
        );

        // Order status breakdown
        const [orderStatusBreakdown] = await db.query(
            `SELECT orderStatus, COUNT(*) as count
             FROM orderDetail
             GROUP BY orderStatus`
        );

        // Payment status breakdown
        const [paymentStatusBreakdown] = await db.query(
            `SELECT paymentStatus, COUNT(*) as count
             FROM orderDetail
             GROUP BY paymentStatus`
        );

        // Monthly revenue (last 6 months, excluding cancelled orders)
        const [monthlyRevenue] = await db.query(
            `SELECT 
                DATE_FORMAT(createdAt, '%Y-%m') as month,
                COALESCE(SUM(total), 0) as revenue
             FROM orderDetail
             WHERE paymentStatus = 'successful'
             AND orderStatus != 'Cancelled'
             AND createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
             GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
             ORDER BY month ASC`
        );

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalUsers: usersCount[0].count || 0,
                    totalOrders: ordersCount[0].count || 0,
                    totalRevenue: parseFloat(revenueResult[0].total || 0),
                    totalProducts: productsCount[0].count || 0
                },
                recentOrders,
                recentUsers,
                breakdown: {
                    orderStatus: orderStatusBreakdown,
                    paymentStatus: paymentStatusBreakdown
                },
                charts: {
                    monthlyRevenue
                }
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getDashboardStatsController
};

