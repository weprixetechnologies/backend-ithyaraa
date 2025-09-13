const { sendOtp, sendPayoutOtp, verifyPayoutOtp } = require('./../services/otpService')
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


// Send OTP for payout verification
const sendPayoutOtpController = async (req, res) => {
    try {
        console.log('sendPayoutOtpController - req.user:', req.user);
        console.log('sendPayoutOtpController - req.body:', req.body);
        console.log('sendPayoutOtpController - req.headers:', req.headers);

        const { uid } = req.user;
        const { purpose = 'payout_verification' } = req.body;

        if (!uid) {
            console.log('sendPayoutOtpController - No uid found in req.user');
            return res.status(400).json({ success: false, error: 'User not authenticated' });
        }

        const result = await sendPayoutOtp(uid, purpose);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error sending payout OTP:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// Verify OTP for payout verification
const verifyPayoutOtpController = async (req, res) => {
    try {
        const { uid } = req.user;
        const { otp, purpose = 'payout_verification' } = req.body;

        if (!uid) {
            return res.status(400).json({ success: false, error: 'User not authenticated' });
        }

        if (!otp) {
            return res.status(400).json({ success: false, error: 'OTP is required' });
        }

        const result = await verifyPayoutOtp(uid, otp, purpose);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error verifying payout OTP:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

module.exports = { sendOtpController, verifyOtp, sendPayoutOtpController, verifyPayoutOtpController }