const service = require('../services/categoryService');

const createCoupon = async (req, res) => {
    try {
        const input = req.body;

        const requiredFields = ['couponCode', 'discountType', 'discountValue', 'usage', 'assignedUser'];
        for (const field of requiredFields) {
            if (!input[field]) {
                return res.status(400).json({ success: false, message: `Missing field: ${field}` });
            }
        }

        const result = await service.createCoupon(input);

        res.status(201).json({
            success: true,
            message: 'Coupon created successfully',
            result,
        });
    } catch (err) {
        console.error('Error creating coupon:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    createCoupon,
};
