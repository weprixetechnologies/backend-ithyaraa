const usersService = require('../services/usersService');
const jwt = require('jsonwebtoken');


// Send verification email externally
const sendVerificationEmail = async (req, res) => {
    const { uid } = req.body;
    if (!uid) {
        return res.status(400).json({ success: false, message: 'UID required' });
    }
    try {
        const user = await usersService.getUserByuid(uid);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const result = await usersService.sendVerificationEmail(user);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const createUser = async (req, res) => {
    try {
        const { email, phonenumber, name, password, wallet, referCode } = req.body;
        console.log(req.body);


        if (!email || !phonenumber || !password) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const result = await usersService.createUser({
            email,
            phonenumber,
            name,
            password,
            wallet: wallet || 0,
            referCode : referCode || 'ITHY-ADMIN',
            deviceInfo: req.headers['user-agent'] || 'unknown' // ✅ simple user-agent capture
        });

        if (!result.success) {
            return res.status(409).json(result); // USER EXIST
        }

        return res.status(201).json(result); // Created
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, phonenumber, password } = req.body;

        if ((!email && !phonenumber) || !password) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const result = await usersService.loginUser(
            email || null,
            phonenumber || null,
            password,
            req.headers['user-agent'] // device info
        );

        if (!result.success) {
            return res.status(401).json(result);
        }

        // ✅ Queue email after successful login




        return res.status(200).json(result);
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getUserByUID = async (req, res) => {
    try {
        const { uid } = req.params;

        const user = await usersService.getUserByuid(uid);

        if (!user) {
            return res.status(404).json({ message: "No such user" });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Server error" });
    }
};
const getUserByUIDbyUser = async (req, res) => {
    try {
        const { uid } = req.user;

        const user = await usersService.getUserByuid(uid);

        if (!user) {
            return res.status(404).json({ message: "No such user" });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const updateUserByUIDbyUser = async (req, res) => {
    try {
        const { uid } = req.user; // comes from verified token
        const { name, profilePhoto } = req.body;

        // Basic validation (optional)
        if (!name && !profilePhoto) {
            return res.status(400).json({ message: "No fields to update" });
        }

        const updatedUser = await usersService.updateUserByuid(uid, { name, profilePhoto });

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found or not updated" });
        }

        res.status(200).json({ message: "User updated successfully", user: updatedUser });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Server error" });
    }
};


const getAllUsers = async (req, res, next) => {
    try {
        const { limit, page, ...filters } = req.query;
        console.log(req.query);


        const users = await usersService.getAllUsers(filters, limit, page);
        res.status(200).json({
            page: Number(page),
            limit: Number(limit),
            count: users.length,
            data: users
        });
    } catch (err) {
        next(err);
    }
};


// Forgot password: send reset link
const forgotPasswordTokenised = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email required' });
        }
        // Call service to generate token and send email
        const result = await usersService.sendResetPasswordEmail(email);
        if (!result.success) {
            return res.status(404).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Reset password: user clicks link
const resetPasswordTokenised = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ success: false, message: 'Token and new password required' });
        }
        // Call service to verify token and reset password
        const result = await usersService.resetPasswordWithToken(token, newPassword);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Verify email
const verifyEmail = async (req, res) => {
    const { token } = req.params;
    if (!token) {
        return res.status(400).json({ success: false, message: 'Token missing' });
    }
    try {
        const decoded = jwt.verify(token, process.env.EMAIL_VERIFY_SECRET);
        // Check token expiry manually (jwt.verify throws if expired, but for custom handling):
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
            return res.status(400).json({ success: false, message: 'Token expired' });
        }
        // Find user by UID
        const user = await usersService.getUserByuid(decoded.uid);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (user.verifiedEmail) {
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }
        // Set verified
        const result = await usersService.verifyEmail(decoded.uid);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ success: false, message: 'Token expired' });
        }
        res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }
};
async function forgotPasswordController(req, res) {
    try {
        const { identifier } = req.body;
        if (!identifier) {
            return res.status(400).json({ success: false, message: 'Identifier is required' });
        }

        const result = await usersService.handleForgotPassword(identifier);
        return res.status(200).json(result);
    } catch (err) {
        console.log('Forgot Password Error:', err);
        return res.status(400).json({ success: false, message: err.message });
    }
}

const verifyOtpResetPassword = async (req, res) => {
    try {
        const { otp, identifier } = req.body;
        if (!otp || !identifier) {
            return res.status(400).json({ message: "OTP and identifier are required" });
        }

        const token = await usersService.verifyOtpResetPasswordService(identifier, otp);
        return res.status(200).json({
            message: "OTP verified successfully",
            resetToken: token
        });
    } catch (error) {
        console.error("Error verifying OTP for reset:", error);
        return res.status(400).json({ message: error.message || "Verification failed" });
    }
};


module.exports = {
    verifyOtpResetPassword,
    createUser, getUserByUID,
    loginUser, forgotPasswordTokenised, resetPasswordTokenised, getAllUsers,
    verifyEmail,
    sendVerificationEmail, forgotPasswordController, getUserByUIDbyUser, updateUserByUIDbyUser
};
