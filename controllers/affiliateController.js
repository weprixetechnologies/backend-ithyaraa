const affiliateService = require('./../services/affiliateService')

const applyAffiliate = async (req, res) => {
    try {
        const { emailID, uid } = req.user;
        if (!emailID || !uid) {
            return res.status(400).json({ error: 'emailID, uid, and otp are required' });
        }

        const response = await affiliateService.applyAffiliateService(emailID, uid);
        res.status(200).json(response);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};



const approveAffiliate = async (req, res) => {
    try {
        const { uid, emailID, phonenumber } = req.user; // comes from authentication middleware
        if (!uid) {
            return res.status(400).json({ error: 'UID not found in token/user' });
        }

        const response = await affiliateService.approveAffiliateService(uid, emailID, phonenumber);
        res.status(200).json(response);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

module.exports = { applyAffiliate, approveAffiliate }