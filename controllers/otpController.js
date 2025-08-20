const { sendOtp } = require('./../services/otpService')
const otpService = require('./../services/otpService')

const sendOtpController = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) return res.status(400).json({ error: "Phone number required" });

        const result = await sendOtp(phoneNumber);
        return res.json(result);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal server error" });
    }
};

async function verifyOtp(req, res) {
    try {
        const { phoneNumber, otp } = req.body;
        console.log(req.body);


        if (!phoneNumber || !otp) {
            return res.status(400).json({ success: false, message: 'phoneNumber and otp are required' });
        }

        const result = await otpService.verifyOtp(phoneNumber, otp);
        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}


module.exports = { sendOtpController, verifyOtp }