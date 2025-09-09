const affiliateModel = require('./../model/affiliateModel')
const { addSendEmailJob } = require('./../queue/emailProducer')

const applyAffiliateService = async (emailID, uid, otp) => {
    // You can verify OTP here if you have an OTP table or verification logic.
    // For now, we're just updating status directly.

    const result = await affiliateModel.updateAffiliateStatus(emailID, uid);

    if (result.affectedRows === 0) {
        throw new Error('User not found or update failed');
    }

    return { message: 'Affiliate status updated to pending' };
};

const approveAffiliateService = async (uid, emailID, phonenumber) => {
    const result = await affiliateModel.approveAffiliateByUID(uid);

    if (result.affectedRows === 0) {
        throw new Error('User not found or update failed');
    }


    await addSendEmailJob({
        to: emailID,
        templateName: 'login',
        variables: {
            emailID: emailID,
            phonenumber: phonenumber,
            time: new Date().toLocaleString()
        },
        subject: 'Account Created Successfully'
    });


    return { message: 'Affiliate approved successfully' };
};

const getAllAffiliateTransactions = async (uid, filters = {}) => {
    return await affiliateModel.getAffiliateTransactions(uid, filters);
};

module.exports = { applyAffiliateService, approveAffiliateService, getAllAffiliateTransactions }