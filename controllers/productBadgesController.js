const productBadgesService = require('../services/productBadgesService');

const getAllBadges = async (req, res) => {
    try {
        const badges = await productBadgesService.getAllBadges();
        return res.status(200).json({
            success: true,
            data: badges
        });
    } catch (error) {
        console.error('Error in getAllBadges controller:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch badges'
        });
    }
};

const getBadgeById = async (req, res) => {
    try {
        const { id } = req.params;
        const badge = await productBadgesService.getBadgeById(id);
        if (!badge) {
            return res.status(404).json({
                success: false,
                message: 'Badge not found'
            });
        }
        return res.status(200).json({
            success: true,
            data: badge
        });
    } catch (error) {
        console.error('Error in getBadgeById controller:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch badge'
        });
    }
};

const createBadge = async (req, res) => {
    try {
        const { name, bgColor, textColor, icon, isActive, displayOrder } = req.body;
        const badge = await productBadgesService.createBadge({
            name,
            bgColor,
            textColor,
            icon,
            isActive,
            displayOrder
        });
        return res.status(201).json({
            success: true,
            message: 'Badge created successfully',
            data: badge
        });
    } catch (error) {
        console.error('Error in createBadge controller:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to create badge'
        });
    }
};

const updateBadge = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, bgColor, textColor, icon, isActive, displayOrder } = req.body;
        const badge = await productBadgesService.updateBadge(id, {
            name,
            bgColor,
            textColor,
            icon,
            isActive,
            displayOrder
        });
        return res.status(200).json({
            success: true,
            message: 'Badge updated successfully',
            data: badge
        });
    } catch (error) {
        console.error('Error in updateBadge controller:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update badge'
        });
    }
};

const deleteBadge = async (req, res) => {
    try {
        const { id } = req.params;
        await productBadgesService.deleteBadge(id);
        return res.status(200).json({
            success: true,
            message: 'Badge deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteBadge controller:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to delete badge'
        });
    }
};

const getBadgeProducts = async (req, res) => {
    try {
        const { id } = req.params;
        const products = await productBadgesService.getBadgeProducts(id);
        return res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        console.error('Error in getBadgeProducts controller:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch badge products'
        });
    }
};

const syncBadgeProducts = async (req, res) => {
    try {
        const { id } = req.params;
        const { productIDs } = req.body; // Array of product IDs
        const products = await productBadgesService.syncBadgeProducts(id, productIDs || []);
        return res.status(200).json({
            success: true,
            message: 'Badge products updated successfully',
            data: products
        });
    } catch (error) {
        console.error('Error in syncBadgeProducts controller:', error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to sync badge products'
        });
    }
};

const getActiveProductBadges = async (req, res) => {
    try {
        const badgesMap = await productBadgesService.getActiveProductBadges();
        return res.status(200).json({
            success: true,
            data: badgesMap
        });
    } catch (error) {
        console.error('Error in getActiveProductBadges controller:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch public product badges'
        });
    }
};

module.exports = {
    getAllBadges,
    getBadgeById,
    createBadge,
    updateBadge,
    deleteBadge,
    getBadgeProducts,
    syncBadgeProducts,
    getActiveProductBadges
};
