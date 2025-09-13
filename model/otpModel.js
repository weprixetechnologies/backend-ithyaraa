const db = require('./../utils/dbconnect');

const saveOtp = async ({ otpHash, phoneNumber, sentOn, expiry }) => {
    const sql = `INSERT INTO otp_sent (otpHash, identifier, sentOn, expiry) VALUES (?, ?, ?, ?)`;
    await db.query(sql, [otpHash, phoneNumber, sentOn, expiry]);
};
const deleteOtpByPhoneNumber = async (phoneNumber) => {
    await db.query('DELETE FROM otp_sent WHERE identifier = ?', [phoneNumber]);
};

// Get OTP record by phone number and otp
async function getOtpRecord(phoneNumber, otp) {
    console.log('executing 2');
    console.log(phoneNumber, otp);


    const [rows] = await db.execute(
        `SELECT * FROM otp_sent 
         WHERE identifier = ? AND otpHash = ?`,
        [phoneNumber, otp]
    );
    console.log(rows[0]);

    return rows[0];
}



// Save OTP with user ID and purpose (using identifier field for user ID)
const saveOtpWithPurpose = async ({ otpHash, uid, purpose, sentOn, expiry }) => {
    try {
        // Store purpose as part of identifier to distinguish from phone-based OTPs
        const identifier = `user_${uid}_${purpose}`;
        console.log('saveOtpWithPurpose - identifier:', identifier);
        const sql = `INSERT INTO otp_sent (otpHash, identifier, sentOn, expiry) VALUES (?, ?, ?, ?)`;
        await db.query(sql, [otpHash, identifier, sentOn, expiry]);
        console.log('saveOtpWithPurpose - OTP saved successfully');
    } catch (error) {
        console.error('saveOtpWithPurpose - Error:', error);
        throw error;
    }
};

// Delete OTP by user ID and purpose
const deleteOtpByUserAndPurpose = async (uid, purpose) => {
    try {
        const identifier = `user_${uid}_${purpose}`;
        console.log('deleteOtpByUserAndPurpose - identifier:', identifier);
        await db.query('DELETE FROM otp_sent WHERE identifier = ?', [identifier]);
        console.log('deleteOtpByUserAndPurpose - OTP deleted successfully');
    } catch (error) {
        console.error('deleteOtpByUserAndPurpose - Error:', error);
        throw error;
    }
};

// Get OTP record by user ID, OTP hash, and purpose
const getOtpRecordByUserAndPurpose = async (uid, otpHash, purpose) => {
    const identifier = `user_${uid}_${purpose}`;
    const [rows] = await db.execute(
        `SELECT * FROM otp_sent 
         WHERE identifier = ? AND otpHash = ?`,
        [identifier, otpHash]
    );
    return rows[0];
};

module.exports = {
    saveOtp,
    deleteOtpByPhoneNumber,
    getOtpRecord,
    saveOtpWithPurpose,
    deleteOtpByUserAndPurpose,
    getOtpRecordByUserAndPurpose
}