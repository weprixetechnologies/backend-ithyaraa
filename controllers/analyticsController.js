const db = require('../utils/dbconnect');

/**
 * Helper to compute date filter query params
 */
const getDateCondition = (range, dateColumn = 'createdAt') => {
    switch (range) {
        case '7d':
            return { sql: `AND ${dateColumn} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`, params: [] };
        case '30d':
            return { sql: `AND ${dateColumn} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, params: [] };
        case '90d':
            return { sql: `AND ${dateColumn} >= DATE_SUB(NOW(), INTERVAL 90 DAY)`, params: [] };
        case 'ytd':
            return { sql: `AND ${dateColumn} >= DATE_FORMAT(NOW(), '%Y-01-01')`, params: [] };
        case 'all':
        default:
            return { sql: '', params: [] };
    }
};

/**
 * Get Customer Retention Analytics
 */
const getRetentionAnalyticsController = async (req, res) => {
    try {
        const { range = '30d' } = req.query;
        const orderDateFilter = getDateCondition(range, 'createdAt');

        // 1. Repeat Purchase Rate (RPR) & Customer Counts
        const [buyerStats] = await db.query(`
            SELECT 
                COUNT(DISTINCT uid) as totalBuyers,
                COUNT(DISTINCT CASE WHEN order_count > 1 THEN uid END) as repeatBuyers,
                COUNT(DISTINCT CASE WHEN order_count = 1 THEN uid END) as singleBuyers,
                COALESCE(AVG(order_count), 1) as avgOrdersPerCustomer
            FROM (
                SELECT uid, COUNT(DISTINCT orderID) as order_count
                FROM orderDetail
                WHERE paymentStatus = 'successful'
                  AND LOWER(orderStatus) != 'cancelled'
                  ${orderDateFilter.sql}
                GROUP BY uid
            ) as customer_orders
        `);

        const totalBuyers = Number(buyerStats[0]?.totalBuyers || 0);
        const repeatBuyers = Number(buyerStats[0]?.repeatBuyers || 0);
        const singleBuyers = Number(buyerStats[0]?.singleBuyers || 0);
        const repeatPurchaseRate = totalBuyers > 0 ? parseFloat(((repeatBuyers / totalBuyers) * 100).toFixed(2)) : 0;
        const avgOrdersPerCustomer = parseFloat(Number(buyerStats[0]?.avgOrdersPerCustomer || 0).toFixed(2));

        // 2. Average Days Between 1st and 2nd Order (Repeat Purchase Interval)
        const [intervalRes] = await db.query(`
            SELECT AVG(days_between) as avgDaysBetween
            FROM (
                SELECT 
                    o1.uid,
                    DATEDIFF(MIN(o2.createdAt), MIN(o1.createdAt)) as days_between
                FROM orderDetail o1
                JOIN orderDetail o2 ON o1.uid = o2.uid AND o2.createdAt > o1.createdAt
                WHERE o1.paymentStatus = 'successful' AND LOWER(o1.orderStatus) != 'cancelled'
                  AND o2.paymentStatus = 'successful' AND LOWER(o2.orderStatus) != 'cancelled'
                GROUP BY o1.uid
            ) as intervals
        `);
        const avgRepeatIntervalDays = parseFloat(Number(intervalRes[0]?.avgDaysBetween || 0).toFixed(1));

        // 3. Customer Lifetime Value (CLV/LTV) & Spend Metrics
        const [clvRes] = await db.query(`
            SELECT 
                COALESCE(SUM(total), 0) as totalRevenue,
                COUNT(DISTINCT orderID) as totalOrders,
                COALESCE(AVG(total), 0) as avgOrderValue,
                COUNT(DISTINCT uid) as uniqueCustomers
            FROM orderDetail
            WHERE paymentStatus = 'successful'
              AND LOWER(orderStatus) != 'cancelled'
              ${orderDateFilter.sql}
        `);

        const totalRevenue = parseFloat(Number(clvRes[0]?.totalRevenue || 0).toFixed(2));
        const totalOrders = Number(clvRes[0]?.totalOrders || 0);
        const avgOrderValue = parseFloat(Number(clvRes[0]?.avgOrderValue || 0).toFixed(2));
        const uniqueCustomers = Number(clvRes[0]?.uniqueCustomers || 0);
        const customerLifetimeValue = uniqueCustomers > 0 ? parseFloat((totalRevenue / uniqueCustomers).toFixed(2)) : 0;

        // 4. Customer Churn Risk & Activity Segmentation
        const [churnSegmentation] = await db.query(`
            SELECT 
                SUM(CASE WHEN days_since_last <= 30 THEN 1 ELSE 0 END) as activeCount,
                SUM(CASE WHEN days_since_last > 30 AND days_since_last <= 90 THEN 1 ELSE 0 END) as atRiskCount,
                SUM(CASE WHEN days_since_last > 90 THEN 1 ELSE 0 END) as churnedCount
            FROM (
                SELECT 
                    uid,
                    DATEDIFF(NOW(), MAX(createdAt)) as days_since_last
                FROM orderDetail
                WHERE paymentStatus = 'successful'
                  AND LOWER(orderStatus) != 'cancelled'
                GROUP BY uid
            ) as customer_activity
        `);

        const activeCustomers = Number(churnSegmentation[0]?.activeCount || 0);
        const atRiskCustomers = Number(churnSegmentation[0]?.atRiskCount || 0);
        const churnedCustomers = Number(churnSegmentation[0]?.churnedCount || 0);

        // Also count users with 0 orders
        const [neverOrderedRes] = await db.query(`
            SELECT COUNT(*) as neverOrderedCount 
            FROM users u
            LEFT JOIN orderDetail o ON u.uid = o.uid AND o.paymentStatus = 'successful'
            WHERE u.role = 'user' AND o.orderID IS NULL
        `);
        const neverOrderedCustomers = Number(neverOrderedRes[0]?.neverOrderedCount || 0);

        // 5. Monthly Cohort Retention Matrix (Last 6 Months)
        const [cohortMatrix] = await db.query(`
            SELECT 
                DATE_FORMAT(u.createdOn, '%Y-%m') as cohortMonth,
                COUNT(DISTINCT u.uid) as initialCohortSize,
                COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.createdOn, o.createdAt) = 0 THEN u.uid END) as month0,
                COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.createdOn, o.createdAt) = 1 THEN u.uid END) as month1,
                COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.createdOn, o.createdAt) = 2 THEN u.uid END) as month2,
                COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.createdOn, o.createdAt) = 3 THEN u.uid END) as month3,
                COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.createdOn, o.createdAt) = 6 THEN u.uid END) as month6
            FROM users u
            LEFT JOIN orderDetail o ON u.uid = o.uid AND o.paymentStatus = 'successful' AND LOWER(o.orderStatus) != 'cancelled'
            WHERE u.role = 'user'
              AND u.createdOn >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(u.createdOn, '%Y-%m')
            ORDER BY cohortMonth DESC
        `);

        // Format cohorts with percentages
        const formattedCohorts = cohortMatrix.map(c => {
            const size = Number(c.initialCohortSize) || 1;
            return {
                cohortMonth: c.cohortMonth,
                initialCohortSize: c.initialCohortSize,
                m0: c.month0,
                m0Pct: parseFloat(((c.month0 / size) * 100).toFixed(1)),
                m1: c.month1,
                m1Pct: parseFloat(((c.month1 / size) * 100).toFixed(1)),
                m2: c.month2,
                m2Pct: parseFloat(((c.month2 / size) * 100).toFixed(1)),
                m3: c.month3,
                m3Pct: parseFloat(((c.month3 / size) * 100).toFixed(1)),
                m6: c.month6,
                m6Pct: parseFloat(((c.month6 / size) * 100).toFixed(1)),
            };
        });

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    repeatPurchaseRate,
                    totalBuyers,
                    repeatBuyers,
                    singleBuyers,
                    avgOrdersPerCustomer,
                    avgRepeatIntervalDays,
                    customerLifetimeValue,
                    avgOrderValue,
                    totalRevenue
                },
                segmentation: {
                    active: activeCustomers,
                    atRisk: atRiskCustomers,
                    churned: churnedCustomers,
                    neverOrdered: neverOrderedCustomers
                },
                cohorts: formattedCohorts
            }
        });
    } catch (error) {
        console.error('Error fetching retention analytics:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Customer Onboarding Analytics
 */
const getOnboardingAnalyticsController = async (req, res) => {
    try {
        const { range = '30d' } = req.query;
        const userDateFilter = getDateCondition(range, 'createdOn');

        // 1. Total Signups & Registration Trend
        const [signupTrend] = await db.query(`
            SELECT 
                DATE_FORMAT(createdOn, '%Y-%m-%d') as date,
                COUNT(*) as signups
            FROM users
            WHERE role = 'user'
              ${userDateFilter.sql}
            GROUP BY DATE_FORMAT(createdOn, '%Y-%m-%d')
            ORDER BY date ASC
        `);

        // Total Signups in period
        const [totalSignupsRes] = await db.query(`
            SELECT COUNT(*) as count 
            FROM users 
            WHERE role = 'user'
              ${userDateFilter.sql}
        `);
        const totalSignups = Number(totalSignupsRes[0]?.count || 0);

        // 2. Onboarding Funnel Steps
        // Step 1: Registered
        // Step 2: Verified (Email or Phone)
        const [verifiedRes] = await db.query(`
            SELECT COUNT(*) as count 
            FROM users 
            WHERE role = 'user' AND (verifiedEmail = 1 OR verifiedPhone = 1)
              ${userDateFilter.sql}
        `);
        const verifiedUsers = Number(verifiedRes[0]?.count || 0);

        // Step 3: Interest (Added to Cart or Wishlist)
        const [interestRes] = await db.query(`
            SELECT COUNT(DISTINCT u.uid) as count
            FROM users u
            WHERE u.role = 'user'
              ${userDateFilter.sql}
              AND (
                EXISTS (SELECT 1 FROM cartDetail c WHERE c.uid = u.uid)
                OR EXISTS (SELECT 1 FROM wishlistDetail w WHERE w.uid = u.uid)
              )
        `);
        const interestedUsers = Number(interestRes[0]?.count || 0);

        // Step 4: Purchased (Placed at least 1 order)
        const [purchasedRes] = await db.query(`
            SELECT COUNT(DISTINCT u.uid) as count
            FROM users u
            JOIN orderDetail o ON u.uid = o.uid AND o.paymentStatus = 'successful' AND LOWER(o.orderStatus) != 'cancelled'
            WHERE u.role = 'user'
              ${userDateFilter.sql}
        `);
        const convertedUsers = Number(purchasedRes[0]?.count || 0);

        const funnel = {
            registered: totalSignups,
            verified: verifiedUsers,
            verifiedRate: totalSignups > 0 ? parseFloat(((verifiedUsers / totalSignups) * 100).toFixed(1)) : 0,
            interested: interestedUsers,
            interestedRate: totalSignups > 0 ? parseFloat(((interestedUsers / totalSignups) * 100).toFixed(1)) : 0,
            converted: convertedUsers,
            conversionRate: totalSignups > 0 ? parseFloat(((convertedUsers / totalSignups) * 100).toFixed(1)) : 0
        };

        // 3. Time to First Order (TTFO) - Average days from user creation to 1st order
        const [ttfoRes] = await db.query(`
            SELECT 
                AVG(hours_to_first_order) / 24.0 as avgDaysToFirstOrder
            FROM (
                SELECT 
                    u.uid,
                    TIMESTAMPDIFF(HOUR, u.createdOn, MIN(o.createdAt)) as hours_to_first_order
                FROM users u
                JOIN orderDetail o ON u.uid = o.uid AND o.paymentStatus = 'successful'
                WHERE u.role = 'user'
                  ${userDateFilter.sql}
                GROUP BY u.uid
            ) as user_first_orders
        `);
        const avgDaysToFirstOrder = parseFloat(Number(ttfoRes[0]?.avgDaysToFirstOrder || 0).toFixed(1));

        // 4. First-Order Conversion Windows (1 day, 7 days, 30 days)
        const [conversionWindowsRes] = await db.query(`
            SELECT 
                SUM(CASE WHEN hours_to_first_order <= 24 THEN 1 ELSE 0 END) as orderedWithin24h,
                SUM(CASE WHEN hours_to_first_order <= 168 THEN 1 ELSE 0 END) as orderedWithin7d,
                SUM(CASE WHEN hours_to_first_order <= 720 THEN 1 ELSE 0 END) as orderedWithin30d
            FROM (
                SELECT 
                    u.uid,
                    TIMESTAMPDIFF(HOUR, u.createdOn, MIN(o.createdAt)) as hours_to_first_order
                FROM users u
                JOIN orderDetail o ON u.uid = o.uid AND o.paymentStatus = 'successful'
                WHERE u.role = 'user'
                  ${userDateFilter.sql}
                GROUP BY u.uid
            ) as windows
        `);

        const conversionWindows = {
            within24h: Number(conversionWindowsRes[0]?.orderedWithin24h || 0),
            within24hRate: totalSignups > 0 ? parseFloat(((Number(conversionWindowsRes[0]?.orderedWithin24h || 0) / totalSignups) * 100).toFixed(1)) : 0,
            within7d: Number(conversionWindowsRes[0]?.orderedWithin7d || 0),
            within7dRate: totalSignups > 0 ? parseFloat(((Number(conversionWindowsRes[0]?.orderedWithin7d || 0) / totalSignups) * 100).toFixed(1)) : 0,
            within30d: Number(conversionWindowsRes[0]?.orderedWithin30d || 0),
            within30dRate: totalSignups > 0 ? parseFloat(((Number(conversionWindowsRes[0]?.orderedWithin30d || 0) / totalSignups) * 100).toFixed(1)) : 0
        };

        // 5. Onboarding Channels / Referral vs Direct
        const [channelRes] = await db.query(`
            SELECT 
                COUNT(CASE WHEN referCode IS NOT NULL AND referCode != '' THEN 1 END) as referralCount,
                COUNT(CASE WHEN referCode IS NULL OR referCode = '' THEN 1 END) as directCount
            FROM users
            WHERE role = 'user'
              ${userDateFilter.sql}
        `);

        const acquisitionChannels = {
            referral: Number(channelRes[0]?.referralCount || 0),
            direct: Number(channelRes[0]?.directCount || 0)
        };

        res.status(200).json({
            success: true,
            data: {
                totalSignups,
                avgDaysToFirstOrder,
                funnel,
                conversionWindows,
                acquisitionChannels,
                signupTrend
            }
        });
    } catch (error) {
        console.error('Error fetching onboarding analytics:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Unified Single-Page Overview & All Other Stats
 */
const getUnifiedAnalyticsController = async (req, res) => {
    try {
        const { range = '30d' } = req.query;
        const orderDateFilter = getDateCondition(range, 'createdAt');
        const userDateFilter = getDateCondition(range, 'createdOn');

        // 1. Core KPIs
        const [kpiRes] = await db.query(`
            SELECT 
                COALESCE(SUM(total), 0) as totalRevenue,
                COUNT(DISTINCT orderID) as totalOrders,
                COALESCE(AVG(total), 0) as avgOrderValue,
                COUNT(DISTINCT uid) as purchasingCustomers
            FROM orderDetail
            WHERE paymentStatus = 'successful' AND LOWER(orderStatus) != 'cancelled'
              ${orderDateFilter.sql}
        `);

        const [usersCountRes] = await db.query(`
            SELECT COUNT(*) as count FROM users WHERE role = 'user' ${userDateFilter.sql}
        `);

        // 2. Revenue & Sales Trend (Daily / Monthly)
        const [salesTrend] = await db.query(`
            SELECT 
                DATE_FORMAT(createdAt, '%Y-%m-%d') as date,
                COALESCE(SUM(total), 0) as revenue,
                COUNT(DISTINCT orderID) as orders
            FROM orderDetail
            WHERE paymentStatus = 'successful' AND LOWER(orderStatus) != 'cancelled'
              ${orderDateFilter.sql}
            GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
            ORDER BY date ASC
        `);

        // 3. Payment Mode Distribution (Prepaid vs COD)
        const [paymentModeRes] = await db.query(`
            SELECT 
                paymentMode,
                COUNT(*) as count,
                COALESCE(SUM(total), 0) as amount
            FROM orderDetail
            WHERE paymentStatus = 'successful' AND LOWER(orderStatus) != 'cancelled'
              ${orderDateFilter.sql}
            GROUP BY paymentMode
        `);

        // 4. Order Status Breakdown
        const [orderStatusRes] = await db.query(`
            SELECT 
                orderStatus,
                COUNT(*) as count
            FROM orderDetail
            WHERE 1=1 ${orderDateFilter.sql}
            GROUP BY orderStatus
        `);

        // 5. Top 5 Bestselling Products
        const [topProducts] = await db.query(`
            SELECT 
                oi.productID,
                oi.name as productName,
                oi.featuredImage,
                COUNT(DISTINCT oi.orderID) as ordersCount,
                SUM(oi.quantity) as totalQuantity,
                COALESCE(SUM(oi.lineTotalAfter), 0) as totalRevenue
            FROM order_items oi
            JOIN orderDetail od ON oi.orderID = od.orderID
            WHERE od.paymentStatus = 'successful' AND LOWER(od.orderStatus) != 'cancelled'
              ${getDateCondition(range, 'oi.createdAt').sql}
            GROUP BY oi.productID, oi.name, oi.featuredImage
            ORDER BY totalRevenue DESC
            LIMIT 5
        `);

        // 6. Top 5 Categories Performance
        let topCategories = [];
        try {
            const [categoriesRes] = await db.query(`
                SELECT 
                    c.categoryID,
                    c.categoryName,
                    COUNT(DISTINCT oi.orderID) as ordersCount,
                    COALESCE(SUM(oi.lineTotalAfter), 0) as categoryRevenue
                FROM categories c
                JOIN products p ON (p.categories LIKE CONCAT('%', c.categoryName, '%') OR p.categories LIKE CONCAT('%', c.categoryID, '%'))
                JOIN order_items oi ON oi.productID = p.productID
                JOIN orderDetail od ON oi.orderID = od.orderID
                WHERE od.paymentStatus = 'successful' AND LOWER(od.orderStatus) != 'cancelled'
                  ${getDateCondition(range, 'oi.createdAt').sql}
                GROUP BY c.categoryID, c.categoryName
                ORDER BY categoryRevenue DESC
                LIMIT 5
            `);
            topCategories = categoriesRes;
        } catch (catErr) {
            console.warn('Category analytics fallback triggered:', catErr.message);
            topCategories = [];
        }

        // 7. Top Brand Performance
        // Fixed: users table has name, username, uid (no brandID or brandName column on users)
        let topBrands = [];
        try {
            const [brandsRes] = await db.query(`
                SELECT 
                    oi.brandID,
                    COALESCE(NULLIF(b.name, ''), b.username, oi.brandID, 'In-house Brand') as brandName,
                    COUNT(DISTINCT oi.orderID) as ordersCount,
                    COALESCE(SUM(oi.lineTotalAfter), 0) as brandRevenue
                FROM order_items oi
                LEFT JOIN users b ON oi.brandID = b.uid
                JOIN orderDetail od ON oi.orderID = od.orderID
                WHERE od.paymentStatus = 'successful' AND LOWER(od.orderStatus) != 'cancelled'
                  ${getDateCondition(range, 'oi.createdAt').sql}
                GROUP BY oi.brandID, b.name, b.username
                ORDER BY brandRevenue DESC
                LIMIT 5
            `);
            topBrands = brandsRes;
        } catch (brandErr) {
            console.warn('Brand analytics fallback triggered:', brandErr.message);
            topBrands = [];
        }

        // 8. Auto-generated Executive Highlights & Insights
        const totalRevenue = parseFloat(Number(kpiRes[0]?.totalRevenue || 0).toFixed(2));
        const totalOrders = Number(kpiRes[0]?.totalOrders || 0);
        const avgOrderValue = parseFloat(Number(kpiRes[0]?.avgOrderValue || 0).toFixed(2));
        const newUsers = Number(usersCountRes[0]?.count || 0);

        const insights = [];
        if (totalRevenue > 0) {
            insights.push(`Generated ₹${totalRevenue.toLocaleString('en-IN')} across ${totalOrders} orders with an AOV of ₹${avgOrderValue.toLocaleString('en-IN')}.`);
        } else {
            insights.push('No revenue recorded for the selected time window.');
        }

        if (newUsers > 0) {
            insights.push(`Acquired ${newUsers} new customer registrations during this period.`);
        }

        res.status(200).json({
            success: true,
            data: {
                kpis: {
                    totalRevenue,
                    totalOrders,
                    avgOrderValue,
                    newUsers,
                    purchasingCustomers: Number(kpiRes[0]?.purchasingCustomers || 0)
                },
                insights,
                salesTrend,
                paymentModes: paymentModeRes,
                orderStatuses: orderStatusRes,
                topProducts,
                topCategories,
                topBrands
            }
        });
    } catch (error) {
        console.error('Error fetching unified analytics:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Export Analytics Reports as CSV
 */
const exportAnalyticsReportController = async (req, res) => {
    try {
        const { type = 'sales', range = '30d' } = req.query;
        const orderDateFilter = getDateCondition(range, 'createdAt');
        const userDateFilter = getDateCondition(range, 'createdOn');

        let filename = `report_${type}_${range}.csv`;
        let csvContent = '';

        if (type === 'retention') {
            const [cohorts] = await db.query(`
                SELECT 
                    DATE_FORMAT(u.createdOn, '%Y-%m') as Cohort_Month,
                    COUNT(DISTINCT u.uid) as Initial_Cohort_Users,
                    COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.createdOn, o.createdAt) = 0 THEN u.uid END) as Month_0_Buyers,
                    COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.createdOn, o.createdAt) = 1 THEN u.uid END) as Month_1_Buyers,
                    COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.createdOn, o.createdAt) = 2 THEN u.uid END) as Month_2_Buyers,
                    COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(MONTH, u.createdOn, o.createdAt) = 3 THEN u.uid END) as Month_3_Buyers
                FROM users u
                LEFT JOIN orderDetail o ON u.uid = o.uid AND o.paymentStatus = 'successful'
                WHERE u.role = 'user'
                GROUP BY DATE_FORMAT(u.createdOn, '%Y-%m')
                ORDER BY Cohort_Month DESC
            `);

            csvContent = 'Cohort Month,Initial Cohort Users,Month 0 Buyers,Month 1 Buyers,Month 2 Buyers,Month 3 Buyers\n';
            cohorts.forEach(c => {
                csvContent += `"${c.Cohort_Month}",${c.Initial_Cohort_Users},${c.Month_0_Buyers},${c.Month_1_Buyers},${c.Month_2_Buyers},${c.Month_3_Buyers}\n`;
            });
        } else if (type === 'onboarding') {
            const [signups] = await db.query(`
                SELECT 
                    uid,
                    username,
                    emailID,
                    phonenumber,
                    verifiedEmail,
                    verifiedPhone,
                    referCode,
                    createdOn
                FROM users
                WHERE role = 'user' ${userDateFilter.sql}
                ORDER BY createdOn DESC
            `);

            csvContent = 'User ID,Username,Email,Phone,Verified Email,Verified Phone,Referral Code,Created On\n';
            signups.forEach(u => {
                csvContent += `"${u.uid}","${u.username || ''}","${u.emailID || ''}","${u.phonenumber || ''}",${u.verifiedEmail},${u.verifiedPhone},"${u.referCode || ''}","${u.createdOn}"\n`;
            });
        } else {
            // Default: Sales & Orders Report
            const [orders] = await db.query(`
                SELECT 
                    o.orderID,
                    o.uid,
                    u.username,
                    o.total,
                    o.paymentMode,
                    o.paymentStatus,
                    o.orderStatus,
                    o.createdAt
                FROM orderDetail o
                LEFT JOIN users u ON o.uid = u.uid
                WHERE 1=1 ${orderDateFilter.sql}
                ORDER BY o.createdAt DESC
            `);

            csvContent = 'Order ID,User ID,Customer Name,Total Amount,Payment Mode,Payment Status,Order Status,Created At\n';
            orders.forEach(o => {
                csvContent += `"${o.orderID}","${o.uid}","${o.username || ''}",${o.total},"${o.paymentMode}","${o.paymentStatus}","${o.orderStatus}","${o.createdAt}"\n`;
            });
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csvContent);
    } catch (error) {
        console.error('Error exporting report:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getRetentionAnalyticsController,
    getOnboardingAnalyticsController,
    getUnifiedAnalyticsController,
    exportAnalyticsReportController
};
