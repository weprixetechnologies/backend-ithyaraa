const db = require('../utils/dbconnect');

// Get brand review statistics
const getBrandReviewStats = async (brandID) => {
    const [rows] = await db.query(
        `SELECT 
            COALESCE(ROUND(AVG(r.rating), 1), 0) as avgStars,
            COUNT(r.reviewID) as totalReviews,
            COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approvedReviews
         FROM users u
         LEFT JOIN products p ON p.brandID COLLATE utf8mb4_unicode_ci = u.uid COLLATE utf8mb4_unicode_ci
         LEFT JOIN reviews r ON r.productID COLLATE utf8mb4_unicode_ci = p.productID COLLATE utf8mb4_unicode_ci AND r.status = 'approved'
         WHERE u.uid = ? AND u.role = 'brand'
         GROUP BY u.uid`,
        [brandID]
    );
    return rows[0] || { avgStars: 0, totalReviews: 0, approvedReviews: 0 };
};

module.exports = {
    getBrandReviewStats
};

