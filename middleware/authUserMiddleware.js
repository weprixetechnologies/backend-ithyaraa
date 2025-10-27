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

module.exports = { verifyAccessToken }
