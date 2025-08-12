const model = require('../model/couponsModel');


const generateUniqueCouponID = async () => {
    let uniqueCode;

    do {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit number
        uniqueCode = `ITHYCOP-${randomSuffix}`;
    } while (await model.checkCouponExists(uniqueCode));

    return uniqueCode;
};


const createCoupon = async (couponInput) => {
    const uniqueCouponID = await generateUniqueCouponID(couponInput.couponCode);

    const couponData = {
        ...couponInput,
        couponID: uniqueCouponID,
        couponUsage: couponInput.couponUsage || 0,
    };
    console.log('Data', couponData);

    const result = await model.insertCoupon(couponData);
    return result
};

const getAllCoupons = async (page = 1, limit = 10, filters = {}) => {
    const data = await model.getPaginatedCoupons({ page, limit, filters });
    return { data, page, limit };
};

const getCouponCount = async (filters = {}) => {
    const total = await model.getCouponCount(filters);
    return total;
};
const getCouponDetail = async (couponID) => {
    try {
        const coupon = await model.getCouponByID(couponID);
        return coupon;
    } catch (error) {
        console.error('Error in getCouponDetail service:', error);
        throw error; // Pass it to controller to respond
    }
};

const updateCoupon = async (couponID, updateData) => {
    const updated = await model.updateCoupon(couponID, updateData);

    if (!updated) {
        throw new Error(`Coupon with ID '${couponID}' not found or no changes made`);
    }

    return { message: 'Coupon updated successfully' };
};

module.exports = {
    createCoupon, getAllCoupons, getCouponCount, getCouponDetail, updateCoupon
};
