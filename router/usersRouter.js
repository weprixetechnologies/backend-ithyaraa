const express = require('express')

const userRouter = express.Router()
const usersController = require('./../controllers/usersController')
const otpController = require('./../controllers/otpController')
const authMiddleware = require('./../middleware/authAdminMiddleware')

userRouter.post('/create-user', usersController.createUser);
userRouter.post('/login', usersController.loginUser);
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

module.exports = userRouter