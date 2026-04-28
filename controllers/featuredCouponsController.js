const model = require('../model/featuredCouponsModel');
const { deleteCache } = require('../utils/cacheHelper');
const { SCOPE } = require('../utils/cacheScopes');

/**
 * Create a featured coupon (Admin)
 */
const createCoupon = async (req, res) => {
    try {
        const { popupImage, iconImage, couponCode } = req.body;

        if (!popupImage || !iconImage || !couponCode) {
            return res.status(400).json({
                success: false,
                message: 'popupImage, iconImage and couponCode are required'
            });
        }

        const result = await model.create({ popupImage, iconImage, couponCode });

        if (!result.success) {
            return res.status(500).json(result);
        }

        try { await deleteCache(SCOPE.HOME_DATA); } catch (e) { console.error(e); }

        return res.status(201).json({ success: true, id: result.id });
    } catch (error) {
        console.error('featuredCouponsController.createCoupon error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

/**
 * Get active featured coupon (Public)
 */
const getActiveCoupon = async (req, res) => {
    try {
        const result = await model.getActive();
        if (!result.success) {
            return res.status(500).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('featuredCouponsController.getActiveCoupon error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

/**
 * Get all featured coupons (Admin)
 */
const getAllCoupons = async (req, res) => {
    try {
        const result = await model.getAll();
        if (!result.success) {
            return res.status(500).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('featuredCouponsController.getAllCoupons error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

/**
 * Get featured coupon by ID (Admin)
 */
const getCouponById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getById(id);
        if (!result.success) {
            return res.status(404).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('featuredCouponsController.getCouponById error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

/**
 * Update featured coupon (Admin)
 */
const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const { popupImage, iconImage, couponCode, isActive } = req.body;

        const result = await model.updateById(id, { popupImage, iconImage, couponCode, isActive });

        if (!result.success) {
            return res.status(400).json(result);
        }

        try { await deleteCache(SCOPE.HOME_DATA); } catch (e) { console.error(e); }

        return res.status(200).json({ success: true, message: 'Featured coupon updated' });
    } catch (error) {
        console.error('featuredCouponsController.updateCoupon error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

/**
 * Delete featured coupon (Admin)
 */
const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.deleteById(id);
        if (!result.success) {
            return res.status(404).json(result);
        }

        try { await deleteCache(SCOPE.HOME_DATA); } catch (e) { console.error(e); }

        return res.status(200).json({ success: true, message: 'Featured coupon deleted' });
    } catch (error) {
        console.error('featuredCouponsController.deleteCoupon error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

module.exports = {
    createCoupon,
    getActiveCoupon,
    getAllCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon
};
