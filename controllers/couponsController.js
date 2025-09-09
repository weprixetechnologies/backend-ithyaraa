const service = require('../services/couponsService');

const createCoupon = async (req, res) => {
    try {
        const input = req.body;

        const requiredFields = ['couponCode', 'discountType', 'discountValue', 'usageLimit',];

        for (const field of requiredFields) {
            if (!input[field]) {
                return res.status(400).json({ success: false, message: `Missing field: ${field}` });
            }
        }

        const result = await service.createCoupon(input);

        res.status(201).json({

            result,
        });
    } catch (err) {
        console.error('Error creating coupon:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


const getAllCoupons = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        // Exclude pagination params from filters
        const { page: _p, limit: _l, ...filters } = req.query;

        const result = await service.getAllCoupons(page, limit, filters);

        res.status(200).json({
            success: true,
            message: 'Coupons fetched successfully',
            ...result
        });
    } catch (err) {
        console.error('Error fetching coupons:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getCouponCount = async (req, res) => {
    try {
        const filters = { ...req.query };

        const total = await service.getCouponCount(filters);

        res.status(200).json({
            success: true,
            message: 'Total coupons count fetched successfully',
            total
        });
    } catch (err) {
        console.error('Error fetching coupon count:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
const getCouponDetail = async (req, res) => {
    try {
        const { couponID } = req.params;

        if (!couponID) {
            return res.status(400).json({ success: false, message: 'Missing couponID' });
        }

        const coupon = await service.getCouponDetail(couponID);

        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.status(200).json({ success: true, result: coupon });
    } catch (error) {
        console.error('Error fetching coupon:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const updateCoupon = async (req, res) => {
    try {
        const { couponID } = req.params;
        const updateData = req.body;

        const result = await service.updateCoupon(couponID, updateData);

        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error('Controller error in updateCoupon:', error.message);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update coupon',
        });
    }
};



module.exports = {
    createCoupon,
    getAllCoupons,
    getCouponCount,
    getCouponDetail,
    updateCoupon
};
