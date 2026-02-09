const reviewService = require('../services/reviewService');
const reviewModel = require('../model/reviewModel');
const db = require('../utils/dbconnect');

// Simple URL validator for image URLs
const isValidImageUrl = (url) => {
    try {
        const parsed = new URL(url);
        const allowedProtocols = ['http:', 'https:'];
        if (!allowedProtocols.includes(parsed.protocol)) return false;

        const pathname = parsed.pathname.toLowerCase();
        return (
            pathname.endsWith('.jpg') ||
            pathname.endsWith('.jpeg') ||
            pathname.endsWith('.png') ||
            pathname.endsWith('.webp')
        );
    } catch {
        return false;
    }
};

// Add a review
const addReviewController = async (req, res) => {
    try {
        const uid = req.user.uid;
        const { productID, rating, comment, images, verifiedPurchase } = req.body;

        if (!productID || !rating) {
            return res.status(400).json({
                success: false,
                message: 'Product ID and rating are required'
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Validate images (optional)
        let normalizedImages = undefined;
        if (typeof images !== 'undefined') {
            if (!Array.isArray(images)) {
                return res.status(400).json({
                    success: false,
                    message: 'Images must be an array of URLs'
                });
            }

            if (images.length > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'A maximum of 5 images are allowed per review'
                });
            }

            const cleaned = images.filter(Boolean).map(String);
            for (const url of cleaned) {
                if (!isValidImageUrl(url)) {
                    return res.status(400).json({
                        success: false,
                        message: 'One or more image URLs are invalid or use an unsupported format'
                    });
                }
            }

            normalizedImages = cleaned;
        }

        const review = await reviewService.addReviewService(uid, {
            productID,
            rating,
            comment,
            images: normalizedImages,
            verifiedPurchase
        });

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: review
        });
    } catch (error) {
        console.error('Add review error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Get product reviews
const getProductReviewsController = async (req, res) => {
    try {
        const { productID } = req.params;
        const { page = 1, limit = 10, minRating, sortBy } = req.query;

        if (!productID) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }

        const reviews = await reviewService.getProductReviewsService(productID, {
            page: parseInt(page),
            limit: parseInt(limit),
            minRating: minRating ? parseInt(minRating) : null,
            sortBy
        });

        res.status(200).json({
            success: true,
            data: reviews
        });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get review statistics
const getReviewStatsController = async (req, res) => {
    try {
        const { productID } = req.params;

        if (!productID) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }

        const stats = await reviewService.getProductReviewStatsService(productID);

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get review stats error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Mark review as helpful
const markHelpfulController = async (req, res) => {
    try {
        const { reviewID } = req.params;
        const uid = req.user.uid;

        if (!reviewID) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        const result = await reviewService.markReviewHelpfulService(reviewID, uid);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Mark helpful error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Get user's reviews
const getUserReviewsController = async (req, res) => {
    try {
        const uid = req.user.uid;

        const reviews = await reviewModel.getUserReviews(uid);

        res.status(200).json({
            success: true,
            data: reviews
        });
    } catch (error) {
        console.error('Get user reviews error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete review
const deleteReviewController = async (req, res) => {
    try {
        const { reviewID } = req.params;
        const uid = req.user.uid;

        if (!reviewID) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        await reviewService.deleteReviewService(reviewID, uid);

        res.status(200).json({
            success: true,
            message: 'Review deleted successfully'
        });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Get all reviews (Admin)
const getAllReviewsController = async (req, res) => {
    try {
        const { status } = req.query;

        let whereClause = '1=1';
        const params = [];

        if (status && status !== 'all') {
            whereClause = 'r.status = ?';
            params.push(status);
        }

        const [reviews] = await db.query(
            `SELECT r.*, u.username, u.emailID, u.profilePhoto,
                    p.name as productName, p.featuredImage as productImage
             FROM reviews r
             INNER JOIN users u ON r.uid = u.uid
             LEFT JOIN products p ON r.productID = p.productID
             WHERE ${whereClause}
             ORDER BY r.createdAt DESC`,
            params
        );

        // Fetch all images for these reviews from review_images
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

        // Parse JSON fields safely
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
                    return fallback;
                }
            }
            return value; // Already an object
        };

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
                profilePhoto: safeParse(review.profilePhoto, null),
                productImage: safeParse(review.productImage, null)
            };
        });

        res.status(200).json({
            success: true,
            data: processedReviews
        });
    } catch (error) {
        console.error('Get all reviews error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update review status (Admin)
const updateReviewStatusController = async (req, res) => {
    try {
        const { reviewID } = req.params;
        const { status } = req.body;

        if (!reviewID) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        await reviewModel.updateReviewStatus(reviewID, status);

        res.status(200).json({
            success: true,
            message: `Review ${status} successfully`
        });
    } catch (error) {
        console.error('Update review status error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete review (Admin - no need to check ownership)
const deleteReviewAdminController = async (req, res) => {
    try {
        const { reviewID } = req.params;

        if (!reviewID) {
            return res.status(400).json({
                success: false,
                message: 'Review ID is required'
            });
        }

        const [result] = await db.query(
            `DELETE FROM reviews WHERE reviewID = ?`,
            [reviewID]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Review deleted successfully'
        });
    } catch (error) {
        console.error('Delete review admin error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get review stats (Admin)
const getReviewStatsAdminController = async (req, res) => {
    try {
        const [stats] = await db.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                AVG(rating) as averageRating
             FROM reviews`
        );

        res.status(200).json({
            success: true,
            data: {
                total: stats[0].total || 0,
                pending: stats[0].pending || 0,
                approved: stats[0].approved || 0,
                rejected: stats[0].rejected || 0,
                averageRating: parseFloat(stats[0].averageRating || 0)
            }
        });
    } catch (error) {
        console.error('Get review stats admin error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    addReviewController,
    getProductReviewsController,
    getReviewStatsController,
    markHelpfulController,
    getUserReviewsController,
    deleteReviewController,
    getAllReviewsController,
    updateReviewStatusController,
    deleteReviewAdminController,
    getReviewStatsAdminController
};

