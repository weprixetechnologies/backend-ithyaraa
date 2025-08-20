const express = require('express')

const userRouter = express.Router()
const usersController = require('./../controllers/usersController')
const otpController = require('./../controllers/otpController')

userRouter.post('/create-user', usersController.createUser);
userRouter.post('/login', usersController.loginUser);
userRouter.get("/detail/:uid", usersController.getUserByUID);
userRouter.get('/all-users', usersController.getAllUsers);
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

module.exports = userRouter