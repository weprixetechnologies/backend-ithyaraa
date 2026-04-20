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

        console.log('[VerifyEmailOtp] Incoming', {
            uid,
            hasOtp: !!otp,
            otpLen: typeof otp === 'string' ? otp.length : otp != null ? String(otp).length : 0,
        });

        const user = await usersModel.findUserByUIDFull(uid);
        if (!user) {
            console.warn('[VerifyEmailOtp] User not found for uid:', uid);
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.verifiedEmail === 1) {
            console.warn('[VerifyEmailOtp] Already verified for uid:', uid, 'email:', user.emailID);
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }

        if (!otp) {
            console.warn('[VerifyEmailOtp] Missing OTP for uid:', uid, 'email:', user.emailID);
            return res.status(400).json({ success: false, message: 'OTP is required' });
        }

        console.log('[VerifyEmailOtp] Verifying OTP for email:', user.emailID);
        const result = await otpService.verifyEmailOtp(user.emailID, otp);
        console.log('[VerifyEmailOtp] OTP service result:', result);

        if (result.success) {
            // Mark email as verified
            const verifyRes = await usersService.verifyEmail(uid);
            console.log('[VerifyEmailOtp] Mark email verified result:', verifyRes);
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
        let phoneForOtp = String(user.phonenumber).replace(/\D/g, '').slice(-10);
        const result = await otpService.sendOtp(`+91${phoneForOtp}`);

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

        let phoneForOtp = String(user.phonenumber).replace(/\D/g, '').slice(-10);
        const result = await otpService.verifyOtp(`+91${phoneForOtp}`, otp);

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

