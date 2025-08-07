const model = require('../model/couponsModel');
const { v4: uuidv4 } = require('uuid');

const generateUniqueCouponID = async (couponCode) => {
    let uniqueCode = couponCode;

    while (await model.checkCouponExists(uniqueCode)) {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit number
        uniqueCode = `${couponCode}-${randomSuffix}`;
    }

    return uniqueCode;
};

const createCoupon = async (couponInput) => {
    const couponID = uuidv4();

    const uniqueCouponCode = await generateUniqueCouponID(couponInput.couponCode);

    const couponData = {
        ...couponInput,
        couponID,
        couponCode: uniqueCouponCode,
        couponUsed: couponInput.couponUsed || 0,
    };

    await model.insertCoupon(couponData);

    return { couponID, couponCode: uniqueCouponCode };
};

module.exports = {
    createCoupon,
};
