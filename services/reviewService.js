const reviewModel = require('../model/reviewModel');

// Add a new review
async function addReviewService(uid, reviewData) {
    // Check if user can review (has purchased the product)
    const canReview = await reviewModel.canUserReview(reviewData.productID, uid);
    if (!canReview) {
        throw new Error('You must purchase this product before leaving a review');
    }

    // Check if user has already reviewed
    const hasReviewed = await reviewModel.hasUserReviewed(reviewData.productID, uid);
    if (hasReviewed) {
        throw new Error('You have already reviewed this product');
    }

    // Add the review
    const review = await reviewModel.addReview({
        ...reviewData,
        uid
    });

    return review;
}

// Get product reviews
async function getProductReviewsService(productID, options = {}) {
    const reviews = await reviewModel.getReviews(productID, options);
    return reviews;
}

// Get review statistics
async function getProductReviewStatsService(productID) {
    const stats = await reviewModel.getReviewStats(productID);

    // Calculate average rating and format
    const averageRating = parseFloat(stats.averageRating || 0).toFixed(1);

    return {
        ...stats,
        averageRating: parseFloat(averageRating),
        ratingBreakdown: [
            { rating: 5, count: stats.rating5 || 0 },
            { rating: 4, count: stats.rating4 || 0 },
            { rating: 3, count: stats.rating3 || 0 },
            { rating: 2, count: stats.rating2 || 0 },
            { rating: 1, count: stats.rating1 || 0 }
        ]
    };
}

// Mark review as helpful
async function markReviewHelpfulService(reviewID, uid) {
    return await reviewModel.markHelpful(reviewID, uid);
}

// Get user's reviews
async function getUserReviewsService(uid) {
    return await reviewModel.getUserReviews(uid);
}

// Delete review
async function deleteReviewService(reviewID, uid) {
    const deleted = await reviewModel.deleteReview(reviewID, uid);
    if (!deleted) {
        throw new Error('Review not found or you do not have permission to delete it');
    }
    return { success: true };
}

module.exports = {
    addReviewService,
    getProductReviewsService,
    getProductReviewStatsService,
    markReviewHelpfulService,
    getUserReviewsService,
    deleteReviewService
};

