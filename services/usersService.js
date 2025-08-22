require('dotenv').config();

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const usersModel = require('../model/usersModel');
const tokenUtils = require('./../utils/tokenUtils')
const db = require('./../utils/dbconnect')
const { addSendEmailJob } = require('../queue/emailProducer');
const { generateUID } = require('./../utils/uidUtils');
const { twilioNumber, client } = require('./../utils/message');
const RESET_TOKEN_SECRET = process.env.RESET_TOKEN_SECRET;
const RESET_TOKEN_EXPIRY = 60 * 30; // 30 minutes
const otpModel = require('./../model/otpModel')
const { sendEmail } = require('./../queue/service/emailService')

// Send verification email to user
const sendVerificationEmail = async (user) => {
    // Generate token
    const payload = { uid: user.uid, email: user.emailID };
    const token = jwt.sign(payload, process.env.EMAIL_VERIFY_SECRET, { expiresIn: '1d' });
    // Construct verify link
    const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${token}`;
    // Send email via queue
    await addSendEmailJob({
        to: user.emailID,
        templateName: 'verify-email',
        variables: {
            name: user.name || user.username,
            verifyLink
        },
        subject: 'Verify Your Email'
    });
    return { success: true, message: 'Verification email sent', token };
};


// 1. Send reset password link to email
const sendResetPasswordEmail = async (email) => {
    const user = await usersModel.findUserByEmailOrPhone(email, null);
    if (!user) {
        return { success: false, message: 'User not found' };
    }
    // Generate secure token
    const payload = { uid: user.uid, email: user.emailID };
    const token = jwt.sign(payload, RESET_TOKEN_SECRET, { expiresIn: RESET_TOKEN_EXPIRY });
    // Construct reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    // Send email via queue
    await addSendEmailJob({
        to: user.emailID,
        templateName: 'reset-password',
        variables: {
            name: user.name || user.username,
            resetLink
        },
        subject: 'Reset Your Password'
    });
    return { success: true, message: 'Reset link sent to email', token };
};

// 2. User clicks link and resets password
const resetPasswordWithToken = async (token, newPassword) => {
    try {
        const decoded = jwt.verify(token, RESET_TOKEN_SECRET);
        const user = await usersModel.findByuid(decoded.uid);
        if (!user) {
            return { success: false, message: 'Invalid or expired token' };
        }
        // Hash new password
        const hashedPassword = await argon2.hash(newPassword);
        await usersModel.updatePassword(decoded.uid, hashedPassword);
        // Invalidate all sessions for this user
        await usersModel.deleteSessionByEmail(user.emailID);
        return { success: true, message: 'Password reset successful' };
    } catch (err) {
        return { success: false, message: 'Invalid or expired token' };
    }
};

const createUser = async (userData) => {
    // 1. Check if email or phone exists
    const existingUser = await usersModel.findUserByEmailOrPhone(userData.email, userData.phonenumber);
    if (existingUser) {
        return { success: false, message: 'USER EXIST' };
    }

    // 2. Generate unique UID
    let uid;
    do {
        uid = generateUID();
    } while (await usersModel.findUserByUID(uid)); // Ensure uniqueness

    // 3. Generate unique username
    let base = (userData.name || '').replace(/\s+/g, '').toLowerCase();
    let suffix = 1;
    let finalUsername;
    do {
        const candidate = `${base}_${String(suffix).padStart(2, '0')}`;
        const exists = await usersModel.findUserByUsername(candidate);
        if (!exists) {
            finalUsername = candidate;
            break;
        }
        suffix++;
    } while (suffix < 1000);
    if (!finalUsername) {
        return { success: false, message: 'Could not generate unique username' };
    }

    // 4. Hash password using argon2
    const hashedPassword = await argon2.hash(userData.password);

    // 5. Prepare data for DB
    const newUser = {
        uid,
        username: finalUsername,
        emailID: userData.email,
        phonenumber: userData.phonenumber,
        lastLogin: null,
        deviceInfo: userData.deviceInfo || '',
        joinedOn: new Date(),
        verifiedEmail: 0,
        verifiedPhone: 0,
        balance: userData.wallet,
        createdOn: new Date(),
        name: userData.name,
        password: hashedPassword
    };

    // 6. Insert into DB
    await usersModel.insertUser(newUser);

    // Send verification email
    await sendVerificationEmail(newUser);

    await addSendEmailJob({
        to: userData.email,
        templateName: 'create-account',
        variables: {
            name: userData.name || finalUsername,
            username: finalUsername,
            emailID: userData.email,
            phonenumber: userData.phonenumber,
            time: new Date().toLocaleString()
        },
        subject: 'Account Created Successfully'
    });

    return { success: true, message: 'User created successfully', uid: newUser.uid, username: finalUsername };
};

const loginUser = async (email, phonenumber, password, deviceInfo) => {
    // Step 1: Find user
    const user = await usersModel.findUserByEmailOrPhone(email, phonenumber);
    if (!user) {
        return { success: false, message: 'USER NOT FOUND' };
    }

    // Step 2: Verify password
    const passwordMatch = await argon2.verify(user.password, password);
    if (!passwordMatch) {
        return { success: false, message: 'PASSWORD NOT MATCHED' };
    }

    // Step 3: Delete existing session for this user
    await usersModel.deleteSessionByEmail(user.emailID);

    // Step 4: Generate tokens
    const payload = {
        uid: user.uid,
        username: user.username,
        emailID: user.emailID,
        role: user.role
    };
    const accessToken = tokenUtils.generateAccessToken(payload);
    const refreshToken = tokenUtils.generateRefreshToken(payload);

    // Step 5: Store new session
    await usersModel.createSession({
        username: user.username,
        email: user.emailID,
        phonenumber: user.phonenumber,
        refreshToken,
        deviceInfo: deviceInfo || 'unknown-device'
    });

    // Step 6: Send login email

    await addSendEmailJob({
        to: user.emailID,
        templateName: 'login',
        variables: {
            name: user.name || user.username,
            time: new Date().toLocaleString()
        },
        subject: 'Login Notification'
    });

    // Step 7: Return tokens
    return { success: true, accessToken, refreshToken };
};


const getUserByuid = async (uid) => {
    const user = await usersModel.findUserByUIDFull(uid);
    return user || null;
};

const getAllUsers = async (filters, limit = 10, page = 1) => {
    const allowedColumns = ['uid', 'username', 'emailID', 'status', 'createdAt'];

    const whereClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(filters)) {
        if (allowedColumns.includes(key) && value) {
            if (typeof value === 'string') {
                whereClauses.push(`${key} LIKE ?`);
                values.push(`%${value}%`);
            } else {
                whereClauses.push(`${key} = ?`);
                values.push(value);
            }
        }
    }

    let sql = `SELECT * FROM users`;
    if (whereClauses.length > 0) {
        sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` LIMIT ? OFFSET ?`;
    values.push(Number(limit), (Number(page) - 1) * Number(limit));

    const [rows] = await db.query(sql, values);
    return rows;
};

const verifyEmail = async (uid) => {
    const updated = await usersModel.setEmailVerified(uid);
    if (!updated) {
        return { success: false, message: 'User not found or already verified' };
    }
    return { success: true };
};

function isEmail(identifier) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
}

function isPhone(identifier) {
    return /^\+?\d{10,15}$/.test(identifier); // basic phone regex
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
}
async function handleForgotPassword(identifier) {
    let user;

    // 1. Determine identifier type
    if (isEmail(identifier)) {
        user = await usersModel.findUserByEmail(identifier);
        if (!user) throw new Error('No user found with this email');
    } else if (isPhone(identifier)) {
        user = await usersModel.findUserByPhone(identifier);
        if (!user) throw new Error('No user found with this phone number');
    } else {
        throw new Error('Invalid identifier format');
    }

    // 2. Generate OTP
    const otp = generateOtp();

    // 3. Hash OTP for storage
    const hashedOtp = crypto.createHash("sha256")
        .update(otp)
        .digest("hex");

    // 4. Calculate expiry (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    // or new Date(Date.now() + 86400000);
    await otpModel.deleteOtpByPhoneNumber(identifier); // delete previous OTP for this user

    // 5. Store OTP (hashed + expiry)
    await usersModel.insertOtpRecord({
        identifier,
        otp: hashedOtp,
        type: isEmail(identifier) ? 'email' : 'phone',
        expiresAt         // <-- pass expiry to model
    });

    // 6. Send OTP (plain)
    if (isEmail(identifier)) {
        await sendEmail({
            to: user.emailID,
            templateName: 'reset-password-otp',
            variables: {
                name: user.name || user.username,

                otp: otp
            },
            subject: 'Reset Your Password'
        });
    } else {
        await client.messages.create({
            body: `Your OTP is: ${otp}`,
            from: twilioNumber,
            to: `+91${identifier}`,
        });
    }

    return { success: true, message: 'OTP sent successfully' };
}

const verifyOtpResetPasswordService = async (identifier, otp) => {

    // Determine type: phone vs email
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const identifierType = isEmail ? "emailID" : "phoneNumber";
    const identifierWithCode = isEmail ? identifier : `+91${identifier}`;
    // 1. Find OTP record
    const otpRecord = await usersModel.getOtpRecord(identifierWithCode);
    if (!otpRecord) {
        throw new Error("No OTP found or expired");
    }

    // 2. Compare OTP hash
    const hashedInputOtp = crypto.createHash("sha256")
        .update(otp)
        .digest("hex");

    if (hashedInputOtp !== otpRecord.otpHash) {
        throw new Error("Invalid OTP - Wrong");
    }

    // 3. Find user by identifier
    const user = await usersModel.getUserByIdentifier(identifierType, identifier);

    if (!user) {
        throw new Error("User not found");
    }

    // 4. Generate JWT token (30 min expiry)
    const payload = {
        uid: user.uid,
        identifierWithCode,
        type: identifierType === "email" ? "emailID" : "phoneNumber"
    };
    const token = jwt.sign(payload, process.env.RESET_TOKEN_SECRET, { expiresIn: "30m" });
    await otpModel.deleteOtpByPhoneNumber(identifierWithCode);

    return token;
};

module.exports = {
    createUser, loginUser, getUserByuid, getAllUsers,
    sendResetPasswordEmail, resetPasswordWithToken,
    verifyEmail,
    sendVerificationEmail, handleForgotPassword, verifyOtpResetPasswordService
};
