require('dotenv').config();

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const brandAuthModel = require('../model/brandAuthModel');
const tokenUtils = require('./../utils/tokenUtils')
const db = require('./../utils/dbconnect')
const { addSendEmailJob } = require('../queue/emailProducer');
const { generateUID } = require('./../utils/uidUtils');

// Create brand user
const createBrandUser = async (userData) => {
    // 1. Check if email exists
    const existingUser = await brandAuthModel.findBrandUserByEmail(userData.email);
    if (existingUser) {
        return { success: false, message: 'Brand user already exists with this email' };
    }

    // Validate GSTIN if provided
    if (userData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(userData.gstin)) {
        return { success: false, message: 'Invalid GSTIN format' };
    }

    // 2. Generate unique UID (brandID and uid will be same)
    let uid;
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loop

    do {
        uid = generateUID();
        attempts++;
        if (attempts > maxAttempts) {
            return { success: false, message: 'Could not generate unique UID after maximum attempts' };
        }
    } while (await brandAuthModel.findUserByUID(uid)); // Ensure uniqueness across all users

    // 3. Generate unique username
    let base = (userData.name || '').replace(/\s+/g, '').toLowerCase();
    let suffix = 1;
    let finalUsername;
    let usernameAttempts = 0;
    const maxUsernameAttempts = 1000;

    do {
        const candidate = `${base}_${String(suffix).padStart(2, '0')}`;
        const exists = await brandAuthModel.findUserByUsername(candidate); // Check across ALL users
        if (!exists) {
            finalUsername = candidate;
            break;
        }
        suffix++;
        usernameAttempts++;
        if (usernameAttempts > maxUsernameAttempts) {
            return { success: false, message: 'Could not generate unique username after maximum attempts' };
        }
    } while (suffix < maxUsernameAttempts);

    if (!finalUsername) {
        return { success: false, message: 'Could not generate unique username' };
    }

    // 4. Hash password using argon2
    const hashedPassword = await argon2.hash(userData.password);

    // 5. Prepare data for DB
    const newBrandUser = {
        uid,
        brandID: uid, // brandID and uid are the same
        username: finalUsername,
        emailID: userData.email,
        name: userData.name,
        password: hashedPassword,
        role: 'brand',
        lastLogin: null,
        deviceInfo: userData.deviceInfo || '',
        joinedOn: new Date(),
        verifiedEmail: 0,
        createdOn: new Date(),
        gstin: userData.gstin || null,
        profilePhoto: userData.profilePhoto || null
    };

    // 6. Insert into DB
    await brandAuthModel.insertBrandUser(newBrandUser);

    // Send welcome email
    await addSendEmailJob({
        to: userData.email,
        templateName: 'create-account',
        variables: {
            name: userData.name || finalUsername,
            username: finalUsername,
            emailID: userData.email,
            time: new Date().toLocaleString()
        },
        subject: 'Brand Account Created Successfully'
    });

    return { success: true, message: 'Brand user created successfully', uid: newBrandUser.uid, username: finalUsername };
};

const loginBrandUser = async (email, password, deviceInfo) => {
    // Step 1: Find user
    const user = await brandAuthModel.findBrandUserByEmail(email);
    if (!user) {
        return { success: false, message: 'Brand user not found' };
    }

    // Step 2: Verify password
    const passwordMatch = await argon2.verify(user.password, password);
    if (!passwordMatch) {
        return { success: false, message: 'Invalid password' };
    }

    // Step 3: Delete existing session for this user
    await brandAuthModel.deleteSessionByEmail(user.emailID);

    // Step 4: Generate tokens with brandID
    const payload = {
        uid: user.uid,
        brandID: user.brandID, // brandID and uid are the same
        username: user.username,
        emailID: user.emailID,
        role: user.role
    };
    const accessToken = jwt.sign(payload, process.env.JWT_BRAND_SECRET, { expiresIn: '180m' });
    const refreshToken = jwt.sign(payload, process.env.JWT_BRAND_SECRET, { expiresIn: '30d' });

    // Step 5: Store new session
    await brandAuthModel.createSession({
        username: user.username,
        email: user.emailID,
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
        subject: 'Brand Login Notification'
    });

    // Step 7: Return tokens
    return { success: true, accessToken, refreshToken, user: payload };
};

const refreshBrandToken = async (refreshToken) => {
    try {
        console.log('Received refresh token:', refreshToken);

        const decoded = jwt.verify(refreshToken, process.env.JWT_BRAND_SECRET);
        if (!decoded) {
            console.log('Error 1: Invalid or expired refresh token');
            return { success: false, message: 'Invalid or expired refresh token' };
        }
        console.log('Decoded refresh token payload:', decoded);

        const email = decoded.emailID;
        console.log('Extracted email from token:', email);

        const user = await brandAuthModel.findBrandUserByEmail(email);
        if (!user) {
            console.log('Error 2: No brand user found with email:', email);
            return { success: false, message: 'Brand user not found' };
        }
        console.log('Brand user found:', user);

        const session = await brandAuthModel.findSessionByEmail(email);
        if (!session) {
            console.log('Error 3: No session found for email:', email);
            return { success: false, message: 'Please login again' };
        }
        console.log('Session found:', session);

        // Strip out exp and iat before signing again
        const { exp, iat, ...payload } = decoded;
        console.log('Payload for new tokens:', payload);

        const newAccessToken = jwt.sign(
            { ...payload },
            process.env.JWT_BRAND_SECRET,
            { expiresIn: '180m' }
        );
        console.log('New access token generated');

        const newRefreshToken = jwt.sign(
            { ...payload },
            process.env.JWT_BRAND_SECRET,
            { expiresIn: '30d' }
        );
        console.log('New refresh token generated:', newRefreshToken);

        const updated = await brandAuthModel.updateSessionRefreshToken(email, newRefreshToken);
        if (!updated) {
            console.log('Error 4: Failed to update session with new refresh token');
            return { success: false, message: 'Failed to update session' };
        }
        console.log('Session updated successfully');

        return { success: true, accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
        console.error('Refresh token error:', error);
        return { success: false, message: 'Invalid or expired refresh token' };
    }
};

module.exports = {
    createBrandUser,
    loginBrandUser,
    refreshBrandToken
};
