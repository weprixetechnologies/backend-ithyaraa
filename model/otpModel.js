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



module.exports = { saveOtp, deleteOtpByPhoneNumber, getOtpRecord }