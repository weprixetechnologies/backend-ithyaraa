const db = require('../utils/dbconnect');

// Add a new review
// Note: images are now stored primarily in the review_images table.
// The legacy reviews.images column is kept for backward compatibility but
// is no longer written to for new reviews with images.
async function addReview(reviewData) {
    const { productID, uid, orderID, rating, comment, images, verifiedPurchase } = reviewData;

    // Normalize images
    const imageArray = Array.isArray(images) ? images : [];

    // Use an explicit connection so we can wrap review + image inserts in a transaction
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // For new reviews we do NOT persist images JSON into the reviews table.
        // This keeps the legacy column intact for old data while moving new data
        // into the dedicated review_images table.
        const [result] = await connection.query(
            `INSERT INTO reviews (productID, uid, orderID, rating, comment, images, verified_purchase, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                productID,
                uid,
                orderID || null,
                rating,
                comment || null,
                imageArray.length ? null : null,
                verifiedPurchase || false
            ]
        );

        const reviewID = result.insertId;

        // Insert images into review_images (if any)
        if (imageArray.length > 0) {
            const values = imageArray.map((url) => [reviewID, url]);

            await connection.query(
                `INSERT INTO review_images (reviewID, imageUrl) VALUES ?`,
                [values]
            );
        }

        await connection.commit();

        return {
            reviewID,
            ...reviewData
        };
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error('Rollback error in addReview:', rollbackError);
        }
        throw error;
    } finally {
        connection.release();
    }
}

// Get reviews for a product with pagination and filters
async function getReviews(productID, options = {}) {
    const {
        page = 1,
        limit = 10,
        minRating = null,
        sortBy = 'newest'
    } = options;

    const offset = (page - 1) * limit;

    let whereClause = 'productID = ?';
    const params = [productID];

    // Filter by rating if provided
    if (minRating) {
        whereClause += ' AND rating >= ?';
        params.push(minRating);
    }

    // Filter by status - only show approved reviews
    whereClause += ' AND status = "approved"';

    // Sorting
    let orderBy = 'createdAt DESC';
    if (sortBy === 'oldest') {
        orderBy = 'createdAt ASC';
    } else if (sortBy === 'highest') {
        orderBy = 'rating DESC, createdAt DESC';
    } else if (sortBy === 'lowest') {
        orderBy = 'rating ASC, createdAt DESC';
    }

    // Get reviews with user info
    const [reviews] = await db.query(
        `SELECT r.*, u.username, u.emailID, u.profilePhoto
         FROM reviews r
         INNER JOIN users u ON r.uid = u.uid
         WHERE ${whereClause}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    // Get total count
    const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM reviews WHERE ${whereClause}`,
        params
    );

    // Fetch images from the new review_images table for all loaded reviews
    const reviewIDs = reviews.map((r) => r.reviewID).filter(Boolean);
    let imagesByReviewID = {};

    if (reviewIDs.length > 0) {
        const [imageRows] = await db.query(
            `SELECT reviewID, imageUrl
             FROM review_images
             WHERE reviewID IN (?)`,
            [reviewIDs]
        );

        imagesByReviewID = imageRows.reduce((acc, row) => {
            if (!acc[row.reviewID]) {
                acc[row.reviewID] = [];
            }
            acc[row.reviewID].push(row.imageUrl);
            return acc;
        }, {});
    }

    // Safe JSON parse function
    const safeParse = (value, fallback = null) => {
        if (!value) return fallback;
        if (typeof value === 'string') {
            // If it's a URL, return it as-is
            if (value.startsWith('http://') || value.startsWith('https://')) {
                return value;
            }
            try {
                return JSON.parse(value);
            } catch (e) {
                console.warn('Failed to parse JSON:', value);
                return fallback;
            }
        }
        return value; // Already an object
    };

    // Parse JSON fields and merge legacy images with images from review_images
    const processedReviews = reviews.map(review => {
        const legacyImages = safeParse(review.images, []);
        const newImages = imagesByReviewID[review.reviewID] || [];
        const mergedImages = [
            ...(Array.isArray(legacyImages) ? legacyImages : legacyImages ? [legacyImages] : []),
            ...newImages
        ];

        return {
            ...review,
            images: mergedImages,
            profilePhoto: safeParse(review.profilePhoto, null)
        };
    });

    return {
        reviews: processedReviews,
        total: countResult[0].total,
        page,
        limit,
        totalPages: Math.ceil(countResult[0].total / limit)
    };
}

// Get review statistics for a product
async function getReviewStats(productID) {
    const [stats] = await db.query(
        `SELECT 
            COUNT(*) as totalReviews,
            AVG(rating) as averageRating,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating5,
            SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating4,
            SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating3,
            SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating2,
            SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating1
         FROM reviews
         WHERE productID = ? AND status = 'approved'`,
        [productID]
    );

    return stats[0] || {
        totalReviews: 0,
        averageRating: 0,
        rating5: 0,
        rating4: 0,
        rating3: 0,
        rating2: 0,
        rating1: 0
    };
}

// Check if user can review a product (has purchased it)
async function canUserReview(productID, uid) {
    const [result] = await db.query(
        `SELECT COUNT(*) as count
         FROM order_items oi
         INNER JOIN orderDetail od ON oi.orderID = od.orderID
         WHERE oi.productID = ? AND od.uid = ? AND od.paymentStatus = 'successful'
         LIMIT 1`,
        [productID, uid]
    );

    return result[0].count > 0;
}

// Check if user has already reviewed this product
async function hasUserReviewed(productID, uid) {
    const [result] = await db.query(
        `SELECT reviewID FROM reviews WHERE productID = ? AND uid = ? LIMIT 1`,
        [productID, uid]
    );

    return result.length > 0;
}

// Mark review as helpful
async function markHelpful(reviewID, uid) {
    try {
        await db.query(
            `INSERT INTO review_helpful (reviewID, uid) VALUES (?, ?)`,
            [reviewID, uid]
        );

        // Update helpful count
        await db.query(
            `UPDATE reviews SET helpful_count = helpful_count + 1 WHERE reviewID = ?`,
            [reviewID]
        );

        return { success: true };
    } catch (error) {
        // User already marked as helpful
        return { success: false, alreadyMarked: true };
    }
}

// Get review details
async function getReviewById(reviewID) {
    const [reviews] = await db.query(
        `SELECT r.*, u.username, u.emailID, u.profilePhoto
         FROM reviews r
         INNER JOIN users u ON r.uid = u.uid
         WHERE r.reviewID = ?`,
        [reviewID]
    );

    if (reviews.length === 0) return null;

    const review = reviews[0];

    // Load images from review_images for this review
    const [imageRows] = await db.query(
        `SELECT imageUrl FROM review_images WHERE reviewID = ?`,
        [reviewID]
    );
    const newImages = imageRows.map(row => row.imageUrl);

    // Safe JSON parse function
    const safeParse = (value, fallback = null) => {
        if (!value) return fallback;
        if (typeof value === 'string') {
            // If it's a URL, return it as-is
            if (value.startsWith('http://') || value.startsWith('https://')) {
                return value;
            }
            try {
                return JSON.parse(value);
            } catch (e) {
                console.warn('Failed to parse JSON:', value);
                return fallback;
            }
        }
        return value; // Already an object
    };

    const legacyImages = safeParse(review.images, []);
    const mergedImages = [
        ...(Array.isArray(legacyImages) ? legacyImages : legacyImages ? [legacyImages] : []),
        ...newImages
    ];

    return {
        ...review,
        images: mergedImages,
        profilePhoto: safeParse(review.profilePhoto, null)
    };
}

// Update review status (for admin)
async function updateReviewStatus(reviewID, status) {
    await db.query(
        `UPDATE reviews SET status = ? WHERE reviewID = ?`,
        [status, reviewID]
    );
    return { success: true };
}

// Delete review
async function deleteReview(reviewID, uid) {
    const [result] = await db.query(
        `DELETE FROM reviews WHERE reviewID = ? AND uid = ?`,
        [reviewID, uid]
    );
    return result.affectedRows > 0;
}

// Get reviews by user
async function getUserReviews(uid) {
    const [reviews] = await db.query(
        `SELECT r.*, p.name as productName, p.featuredImage
         FROM reviews r
         INNER JOIN products p ON r.productID = p.productID
         WHERE r.uid = ?
         ORDER BY r.createdAt DESC`,
        [uid]
    );

    // Fetch all images for these reviews
    const reviewIDs = reviews.map((r) => r.reviewID).filter(Boolean);
    let imagesByReviewID = {};

    if (reviewIDs.length > 0) {
        const [imageRows] = await db.query(
            `SELECT reviewID, imageUrl
             FROM review_images
             WHERE reviewID IN (?)`,
            [reviewIDs]
        );

        imagesByReviewID = imageRows.reduce((acc, row) => {
            if (!acc[row.reviewID]) {
                acc[row.reviewID] = [];
            }
            acc[row.reviewID].push(row.imageUrl);
            return acc;
        }, {});
    }

    // Safe JSON parse function
    const safeParse = (value, fallback = null) => {
        if (!value) return fallback;
        if (typeof value === 'string') {
            // If it's a URL, return it as-is
            if (value.startsWith('http://') || value.startsWith('https://')) {
                return value;
            }
            try {
                return JSON.parse(value);
            } catch (e) {
                console.warn('Failed to parse JSON:', value);
                return fallback;
            }
        }
        return value; // Already an object
    };

    return reviews.map(review => {
        const legacyImages = safeParse(review.images, []);
        const newImages = imagesByReviewID[review.reviewID] || [];
        const mergedImages = [
            ...(Array.isArray(legacyImages) ? legacyImages : legacyImages ? [legacyImages] : []),
            ...newImages
        ];

        return {
            ...review,
            images: mergedImages,
            featuredImage: safeParse(review.featuredImage, [])
        };
    });
}

module.exports = {
    addReview,
    getReviews,
    getReviewStats,
    canUserReview,
    hasUserReviewed,
    markHelpful,
    getReviewById,
    updateReviewStatus,
    deleteReview,
    getUserReviews
};

