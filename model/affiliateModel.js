const db = require('./../utils/dbconnect')

const updateAffiliateStatus = async (emailID, uid) => {
    const query = `
        UPDATE users 
        SET affiliate = 'pending'
        WHERE emailID = ? AND uid = ?
    `;
    const [result] = await db.execute(query, [emailID, uid]);
    return result;
};
const approveAffiliateByUID = async (uid) => {
    const query = `
        UPDATE users 
        SET affiliate = 'approved'
        WHERE uid = ?
    `;
    const [result] = await db.execute(query, [uid]);
    return result;
};

module.exports = {
    updateAffiliateStatus, approveAffiliateByUID
};