const brandAuthModel = require('../model/brandAuthModel');
const brandAuthService = require('./brandAuthService');
const brandReviewStatsModel = require('../model/brandReviewStatsModel');

// Get all brands
const getAllBrands = async () => {
    try {
        const brands = await brandAuthModel.getAllBrands();
        return { success: true, data: brands };
    } catch (error) {
        console.error('Get all brands error:', error);
        return { success: false, message: 'Failed to fetch brands' };
    }
};

// Get brand by UID
const getBrandByUID = async (uid) => {
    try {
        const brand = await brandAuthModel.findBrandUserByUID(uid);

        if (!brand) {
            return { success: false, message: 'Brand not found' };
        }

        // Remove sensitive data
        delete brand.password;

        return { success: true, data: brand };
    } catch (error) {
        console.error('Get brand by UID error:', error);
        return { success: false, message: 'Failed to fetch brand' };
    }
};

// Create brand
const createBrandUser = async (userData) => {
    // Reuse the existing brand auth service
    return await brandAuthService.createBrandUser(userData);
};

// Update brand
const updateBrand = async (uid, updateData) => {
    try {
        const brand = await brandAuthModel.findBrandUserByUID(uid);

        if (!brand) {
            return { success: false, message: 'Brand not found' };
        }

        await brandAuthModel.updateBrand(uid, updateData);

        return { success: true, message: 'Brand updated successfully' };
    } catch (error) {
        console.error('Update brand error:', error);
        return { success: false, message: 'Failed to update brand' };
    }
};

// Reset brand password
const resetBrandPassword = async (uid, newPassword) => {
    const argon2 = require('argon2');

    try {
        const brand = await brandAuthModel.findBrandUserByUID(uid);

        if (!brand) {
            return { success: false, message: 'Brand not found' };
        }

        // Hash the new password
        const hashedPassword = await argon2.hash(newPassword);

        // Update the password
        await brandAuthModel.updateBrand(uid, { password: hashedPassword });

        return { success: true, message: 'Password reset successfully' };
    } catch (error) {
        console.error('Reset brand password error:', error);
        return { success: false, message: 'Failed to reset password' };
    }
};

// Get brand review statistics
const getBrandReviewStats = async (brandID) => {
    try {
        const stats = await brandReviewStatsModel.getBrandReviewStats(brandID);

        return {
            success: true,
            data: {
                avgStars: parseFloat(stats.avgStars) || 0,
                totalReviews: parseInt(stats.totalReviews) || 0,
                approvedReviews: parseInt(stats.approvedReviews) || 0
            }
        };
    } catch (error) {
        console.error('Get brand review stats error:', error);
        return { success: false, message: 'Failed to fetch brand review stats' };
    }
};

// Delete brand
const deleteBrand = async (uid) => {
    try {
        const brand = await brandAuthModel.findBrandUserByUID(uid);

        if (!brand) {
            return { success: false, message: 'Brand not found' };
        }

        await brandAuthModel.deleteBrand(uid);

        return { success: true, message: 'Brand deleted successfully' };
    } catch (error) {
        console.error('Delete brand error:', error);
        return { success: false, message: 'Failed to delete brand' };
    }
};

module.exports = {
    getAllBrands,
    getBrandByUID,
    createBrandUser,
    updateBrand,
    resetBrandPassword,
    getBrandReviewStats,
    deleteBrand
};

