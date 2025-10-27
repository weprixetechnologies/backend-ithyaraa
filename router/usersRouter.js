const express = require('express')

const userRouter = express.Router()
const usersController = require('./../controllers/usersController')
const otpController = require('./../controllers/otpController')
const verificationController = require('./../controllers/verificationController')
const authMiddleware = require('./../middleware/authUserMiddleware')

userRouter.post('/create-user', usersController.createUser);
userRouter.post('/login', usersController.loginUser);

// Test route to verify router is working
userRouter.get('/test', (req, res) => {
    console.log('✅ User router test route hit');
    res.json({ success: true, message: 'User router is working' });
});
userRouter.get("/detail/:uid", authMiddleware.verifyAccessToken, usersController.getUserByUID);
userRouter.get("/detail-by-user", authMiddleware.verifyAccessToken, usersController.getUserByUIDbyUser);
userRouter.get('/all-users', usersController.getAllUsers);
userRouter.put(
    "/update-by-user",
    authMiddleware.verifyAccessToken,
    usersController.updateUserByUIDbyUser
);

// Forgot password: send reset link
userRouter.post('/forgot-password-tokenised', usersController.forgotPasswordTokenised); //will use later
userRouter.post('/forgot-password', usersController.forgotPasswordController); //in use with otp
userRouter.post("/verify-otp-reset-password", usersController.verifyOtpResetPassword);
// Reset password: user clicks link
userRouter.post('/reset-password-tokenised', usersController.resetPasswordTokenised);
userRouter.get('/verify-email/:token', usersController.verifyEmail);

// Externally trigger verification email sending
userRouter.post('/send-verification-email', usersController.sendVerificationEmail);
userRouter.post('/send-otp', otpController.sendOtpController)
userRouter.post('/verify-otp', otpController.verifyOtp)

// Payout OTP routes (protected)
userRouter.post('/send-payout-otp', authMiddleware.verifyAccessToken, otpController.sendPayoutOtpController)
userRouter.post('/verify-payout-otp', authMiddleware.verifyAccessToken, otpController.verifyPayoutOtpController)

// Verification routes (protected)
userRouter.post('/send-email-verification-otp', authMiddleware.verifyAccessToken, verificationController.sendEmailVerificationOtp)
userRouter.post('/verify-email-otp', authMiddleware.verifyAccessToken, verificationController.verifyEmailOtp)
userRouter.post('/send-phone-verification-otp', authMiddleware.verifyAccessToken, verificationController.sendPhoneVerificationOtp)
userRouter.post('/verify-phone-otp', authMiddleware.verifyAccessToken, verificationController.verifyPhoneOtp)

module.exports = userRouter