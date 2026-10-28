const jwt = require('jsonwebtoken')

const verifyAccessToken = (req, res, next) => {
    console.log('🔐 User Auth Middleware called for:', req.path);
    let token;
    try {
        // 1️⃣ Get token from Authorization header
        token = req.headers?.authorization?.split(" ")[1]

        console.log('User Access Token:', token ? 'Present' : 'Missing');
        console.log('Authorization header:', req.headers?.authorization);

        if (!token) {
            return res.status(401).json({ message: "Access token missing. Please login." });
        }

        // 2️⃣ Verify token using JWT_SECRET (same as admin)
        console.log('JWT_SECRET available:', process.env.JWT_SECRET ? 'Yes' : 'No');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3️⃣ Check expiry manually (optional, jwt.verify already does it)
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
            return res.status(401).json({ message: "Access token expired. Please refresh token." });
        }

        // 4️⃣ Attach user to req
        req.user = decoded; // contains uid, username, emailID, role, etc.
        req.isGuest = false;
        console.log('✅ Decoded user successfully:', {
            uid: decoded.uid,
            username: decoded.username,
            emailID: decoded.emailID,
            role: decoded.role
        });

        // 5️⃣ Move forward
        next();
    } catch (error) {
        console.error('❌ Token verification error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            token: token ? 'Present' : 'Missing'
        });
        return res.status(401).json({
            message: "Invalid token",
            error: error.message
        });
    }
};

/**
 * Middleware for cart operations: supports both logged-in users and anonymous guests.
 * If a valid Bearer token is present, attaches the authenticated user.
 * If not authenticated, resolves or generates an anonymous session guest_token.
 */
const verifyCartSession = (req, res, next) => {
    let token = req.headers?.authorization?.split(" ")[1];

    // 1️⃣ If Authorization Bearer token is provided, verify it
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                return res.status(401).json({ message: "Access token expired. Please refresh token." });
            }
            req.user = decoded;
            req.isGuest = false;
            return next();
        } catch (error) {
            console.warn('⚠️ Token verification failed in verifyCartSession:', error.message);
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: "Access token expired. Please refresh token." });
            }
            return res.status(401).json({ message: "Invalid token", error: error.message });
        }
    }

    // 2️⃣ Anonymous Session (Guest Cart)
    let guestToken = req.headers['x-guest-token'] || req.cookies?.guest_token || req.body?.guestToken;

    if (!guestToken || typeof guestToken !== 'string' || !/^[a-zA-Z0-9_\-]{8,64}$/.test(guestToken)) {
        guestToken = `g_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }

    // Surface guest token back to client in header
    res.setHeader('x-guest-token', guestToken);

    req.user = {
        uid: guestToken,
        role: 'guest',
        isGuest: true
    };
    req.isGuest = true;
    next();
};

module.exports = { verifyAccessToken, verifyCartSession }
