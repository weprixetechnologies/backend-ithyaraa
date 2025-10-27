const otpService = require('../services/otpService');
const usersService = require('../services/usersService');
const usersModel = require('../model/usersModel');

// Send email verification OTP
const sendEmailVerificationOtp = async (req, res) => {
    try {
        const { uid } = req.user;
        const user = await usersModel.findUserByUIDFull(uid);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.verifiedEmail === 1) {
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }

        const result = await otpService.sendEmailVerificationOtp(user.emailID, user.name);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error sending email verification OTP:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Verify email OTP and mark email as verified
const verifyEmailOtp = async (req, res) => {
    try {
        const { uid } = req.user;
        const { otp } = req.body;

        const user = await usersModel.findUserByUIDFull(uid);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.verifiedEmail === 1) {
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }

        if (!otp) {
            return res.status(400).json({ success: false, message: 'OTP is required' });
        }

        const result = await otpService.verifyEmailOtp(user.emailID, otp);

        if (result.success) {
            // Mark email as verified
            await usersService.verifyEmail(uid);
            return res.status(200).json({ success: true, message: 'Email verified successfully' });
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error verifying email OTP:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Send phone verification OTP
const sendPhoneVerificationOtp = async (req, res) => {
    try {
        const { uid } = req.user;
        const user = await usersModel.findUserByUIDFull(uid);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.verifiedPhone === 1) {
            return res.status(400).json({ success: false, message: 'Phone already verified' });
        }

        // Send OTP to phone
        const result = await otpService.sendOtp(`+91${user.phonenumber}`);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error sending phone verification OTP:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Verify phone OTP and mark phone as verified
const verifyPhoneOtp = async (req, res) => {
    try {
        const { uid } = req.user;
        const { otp } = req.body;

        const user = await usersModel.findUserByUIDFull(uid);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.verifiedPhone === 1) {
            return res.status(400).json({ success: false, message: 'Phone already verified' });
        }

        if (!otp) {
            return res.status(400).json({ success: false, message: 'OTP is required' });
        }

        const result = await otpService.verifyOtp(`+91${user.phonenumber}`, otp);

        if (result.success) {
            // Mark phone as verified
            await usersService.verifyPhone(uid);
            return res.status(200).json({ success: true, message: 'Phone verified successfully' });
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error verifying phone OTP:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    sendEmailVerificationOtp,
    verifyEmailOtp,
    sendPhoneVerificationOtp,
    verifyPhoneOtp
};

