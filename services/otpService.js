
const crypto = require('crypto')
const { saveOtp, deleteOtpByPhoneNumber } = require('./../model/otpModel')
const otpModel = require('./../model/otpModel')

const { client,twilioNumber } = require('./../utils/message');

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

module.exports = { sendOtp, verifyOtp }