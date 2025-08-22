const userModel = require("../model/authModel.js");
const { addSendEmailJob } = require('../queue/emailProducer.js');
const tokenUtils = require('./../utils/tokenUtils.js')
const { generateUID } = require('./../utils/uidUtils.js')
const { generateAccessToken, generateRefreshToken } = require('./../utils/tokenUtils.js')
const sessionModel = require('./../model/sessionModel.js')
const argon = require('argon2')
const jwt = require('jsonwebtoken')

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_SECRET;


const register = async (data) => {
    const { username, emailID, phonenumber, deviceInfo, name, password, role } = data;

    if (!emailID || !phonenumber || !password || !name) {
        const err = new Error("Missing required fields");
        err.status = 400;
        throw err;
    }

    // Check if email or phone exists
    const existing = await userModel.findByEmailOrPhone(emailID, phonenumber);
    if (existing.length > 0) {
        const err = new Error("Email or phone already exists. Please change them.");
        err.status = 400;
        throw err;
    }

    // Ensure unique username
    let finalUsername = username && username.trim() ? username.trim() : null;
    if (finalUsername) {
        const userExists = await userModel.findByUsername(finalUsername);
        if (userExists) {
            finalUsername = null; // force auto-generate
        }
    }
    if (!finalUsername) {
        // Auto-generate username from name
        let base = name.replace(/\s+/g, '').toLowerCase();
        let suffix = 1;
        let candidate;
        do {
            candidate = `${base}_${String(suffix).padStart(2, '0')}`;
            const exists = await userModel.findByUsername(candidate);
            if (!exists) {
                finalUsername = candidate;
                break;
            }
            suffix++;
        } while (suffix < 1000); // avoid infinite loop
        if (!finalUsername) {
            throw new Error("Could not generate unique username");
        }
    }

    // Hash password
    const hashedPassword = await argon.hash(password);

    // Generate UID
    const uid = generateUID();

    // Fallback for deviceInfo
    const safeDeviceInfo = deviceInfo && deviceInfo.trim() ? deviceInfo : "unknown-device";

    // Insert user
    await userModel.createUser({
        uid,
        username: finalUsername,
        emailID,
        phonenumber,
        deviceInfo: safeDeviceInfo,
        name,
        password: hashedPassword,
        role: role || "user"
    });

    // Create tokens
    const accessToken = tokenUtils.generateAccessToken({ uid, username: finalUsername, emailID, role });
    const refreshToken = tokenUtils.generateRefreshToken({ uid, username: finalUsername, emailID, role });

    // Store session
    await userModel.createSession({
        username: finalUsername,
        emailID,
        phonenumber,
        refreshToken,
        deviceInfo: safeDeviceInfo
    });

    // Send welcome email via queue
    await addSendEmailJob({
        to: emailID,
        templateName: 'welcome',
        variables: {
            name,
            username: finalUsername,
            time: new Date().toLocaleString()
        },
        subject: 'Welcome to Ithyaraa!'
    });

    return { accessToken, refreshToken };
};

const loginUser = async (email, password, deviceInfo) => {
    // 1. Fetch user from DB
    console.log(email);

    const user = await userModel.findUserByEmail(email);
    if (!user) {
        console.log('Error 7');

        throw new Error('Invalid email or password');
    }

    // 2. Validate password
    const isPasswordValid = await argon.verify(user.password, password);
    if (!isPasswordValid) {
        console.log('Error 8');

        throw new Error('Invalid password');
    }

    // 3. Create JWT payload
    const payload = { userID: user.uid, email: user.emailID, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    console.log(refreshToken);

    // 4. Remove old session if exists
    await sessionModel.deleteSessionByEmail(user.emailID);

    // 5. Create expiry date for refresh token (from .env value in days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(process.env.REFRESH_TOKEN_EXPIRY, 10));

    // 6. Save new session
    await sessionModel.createSession({
        username: user.username,
        email: user.emailID,
        phonenumber: user.phonenumber,
        refreshToken: refreshToken,
        deviceInfo: deviceInfo || 'No Info',
        expiry: expiryDate || 'No Info'
    });
    return { accessToken, refreshToken, user };
};

const verifyToken = (token, secret) => {
    try {
        return jwt.verify(token, secret);
    } catch {
        return null;
    }
}
const refreshTokens = async (refreshToken) => {
    console.log('Received refresh token:', refreshToken);

    const decoded = verifyToken(refreshToken, REFRESH_TOKEN_SECRET);
    if (!decoded) {
        console.log('Error 1: Invalid or expired refresh token');
        throw new Error('Invalid or expired refresh token');
    }
    console.log('Decoded refresh token payload:', decoded);

    const email = decoded.emailID;
    console.log('Extracted email from token:', email);

    const user = await userModel.findUserByEmail(email);
    if (!user) {
        console.log('Error 2: No user found with email:', email);
        throw new Error('NO USER EXIST');
    }
    console.log('User found:', user);

    const session = await sessionModel.findSessionByEmail(email);
    if (!session) {
        console.log('Error 3: No session found for email:', email);
        throw new Error('PLEASE LOGIN AGAIN');
    }
    console.log('Session found:', session);

    // Uncomment if you want to enforce strict refresh token matching
    /*
    if (session.refreshToken !== refreshToken) {
        console.log('Error 4: Refresh token mismatch');
        console.log('Session token:', session.refreshToken);
        console.log('Provided token:', refreshToken);
        throw new Error('Invalid session refresh token');
    }
    */

    // Strip out exp and iat before signing again
    const { exp, iat, ...payload } = decoded;
    console.log('Payload for new tokens:', payload);

    const newAccessToken = jwt.sign(
        { ...payload },
        ACCESS_TOKEN_SECRET,
        { expiresIn: '15m' }
    );
    console.log('New access token generated');

    const newRefreshToken = jwt.sign(
        { ...payload },
        REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
    );
    console.log('New refresh token generated:', newRefreshToken);

    const updated = await sessionModel.updateRefreshToken(email, newRefreshToken);
    if (!updated) {
        console.log('Error 5: Failed to update refresh token for email:', email);
        throw new Error('Failed to update refresh token');
    }
    console.log('Session refresh token updated successfully');

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};


module.exports = { register, loginUser, refreshTokens }