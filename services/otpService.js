
const crypto = require('crypto')
const { saveOtp, deleteOtpByPhoneNumber, saveOtpWithPurpose, deleteOtpByUserAndPurpose, getOtpRecordByUserAndPurpose } = require('./../model/otpModel')
const otpModel = require('./../model/otpModel')

const { client, twilioNumber } = require('./../utils/message');

// Generate 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Hash OTP
const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

const sendOtp = async (phoneNumber) => {
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const sentOn = new Date();
    const expiry = new Date(sentOn.getTime() + 5 * 60000); // 5 min validity

    // Delete any existing OTP for this phone number
    await deleteOtpByPhoneNumber(phoneNumber);

    // Send OTP via Twilio
    await client.messages.create({
        body: `Your OTP is: ${otp}`,
        from: twilioNumber,
        to: phoneNumber,
    });

    // Save OTP in DB
    await saveOtp({ otpHash, phoneNumber, sentOn, expiry });

    return { success: true, message: "OTP sent successfully" };
};
async function verifyOtp(phoneNumber, otp) {
    // hash incoming OTP
    const hashedOtp = hashOtp(otp);

    // 1. Get OTP record using hashedOtp
    const otpRecord = await otpModel.getOtpRecord(phoneNumber, hashedOtp);
    if (!otpRecord) {
        return { success: false, message: 'Invalid OTP' };
    }

    // 2. Delete OTP once used
    await otpModel.deleteOtpByPhoneNumber(phoneNumber);

    return { success: true, message: 'OTP verified successfully' };
}

// Send OTP for payout verification
const sendPayoutOtp = async (uid, purpose = 'payout_verification') => {
    try {
        console.log('sendPayoutOtp - uid:', uid, 'purpose:', purpose);

        // Get user's phone number from database
        const db = require('./../utils/dbconnect');
        const [userRows] = await db.execute(
            'SELECT phonenumber FROM users WHERE uid = ?',
            [uid]
        );

        console.log('sendPayoutOtp - userRows:', userRows);

        if (!userRows || userRows.length === 0) {
            return { success: false, message: 'User not found' };
        }

        let phoneNumber = userRows[0].phonenumber;
        console.log('sendPayoutOtp - phoneNumber:', phoneNumber);

        if (!phoneNumber) {
            console.log('sendPayoutOtp - No phone number found for user');
            return { success: false, message: 'User phone number not found' };
        }

        // Add +91 country code if not already present
        if (!phoneNumber.startsWith('+91')) {
            // Remove any existing + or 91 prefix
            phoneNumber = phoneNumber.replace(/^(\+91|91)/, '');
            // Add +91 prefix
            phoneNumber = '+91' + phoneNumber;
        }

        console.log('sendPayoutOtp - formatted phoneNumber:', phoneNumber);

        const otp = generateOtp();
        const otpHash = hashOtp(otp);
        const sentOn = new Date();
        const expiry = new Date(sentOn.getTime() + 5 * 60000); // 5 min validity

        console.log('sendPayoutOtp - Generated OTP, deleting existing OTPs');

        // Delete any existing OTP for this user and purpose
        await deleteOtpByUserAndPurpose(uid, purpose);

        console.log('sendPayoutOtp - Sending SMS via Twilio');

        // Send OTP via Twilio
        await client.messages.create({
            body: `Your payout verification OTP is: ${otp}. Valid for 5 minutes.`,
            from: twilioNumber,
            to: phoneNumber,
        });

        console.log('sendPayoutOtp - SMS sent, saving OTP to database');

        // Save OTP in DB with user ID and purpose
        await saveOtpWithPurpose({ otpHash, uid, purpose, sentOn, expiry });

        console.log('sendPayoutOtp - OTP saved successfully');

        return { success: true, message: "OTP sent successfully to your registered phone number" };
    } catch (error) {
        console.error('Error sending payout OTP:', error);
        return { success: false, message: 'Failed to send OTP: ' + error.message };
    }
};

// Verify OTP for payout verification
const verifyPayoutOtp = async (uid, otp, purpose = 'payout_verification') => {
    try {
        // Hash incoming OTP
        const hashedOtp = hashOtp(otp);

        // Get OTP record using uid, hashedOtp, and purpose
        const otpRecord = await getOtpRecordByUserAndPurpose(uid, hashedOtp, purpose);
        if (!otpRecord) {
            return { success: false, message: 'Invalid or expired OTP' };
        }

        // Check if OTP is expired
        if (new Date() > new Date(otpRecord.expiry)) {
            return { success: false, message: 'OTP has expired' };
        }

        // Delete OTP once used
        await deleteOtpByUserAndPurpose(uid, purpose);

        return { success: true, message: 'OTP verified successfully' };
    } catch (error) {
        console.error('Error verifying payout OTP:', error);
        return { success: false, message: 'Failed to verify OTP' };
    }
};

module.exports = { sendOtp, verifyOtp, sendPayoutOtp, verifyPayoutOtp }