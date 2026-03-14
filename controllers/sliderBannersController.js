const service = require('../services/sliderBannersService');

/**
 * Public: get slider banners for frontend (mobile + desktop arrays)
 * Cache-friendly for ISR.
 */
const getActive = async (req, res) => {
    try {
        const result = await service.getActiveForFrontend();
        if (!result.success) {
            return res.status(500).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getActive slider controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Admin: get all slider banners (optional type filter)
 */
const getAll = async (req, res) => {
    try {
        const result = await service.getAllBanners(req.query);
        if (!result.success) {
            return res.status(500).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getAll slider controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Admin: create slider banner (image_url from BunnyCDN after client upload)
 */
const create = async (req, res) => {
    try {
        const result = await service.createBanner(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(201).json(result);
    } catch (error) {
        console.error('Error in create slider controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Admin: delete slider banner
 */
const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await service.deleteBanner(id);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in remove slider controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Admin: reorder banners by type
 * Body: { type: 'mobile'|'desktop', order: [id1, id2, ...] }
 */
const reorder = async (req, res) => {
    try {
        const result = await service.reorderBanners(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in reorder slider controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    getActive,
    getAll,
    create,
    remove,
    reorder
};
