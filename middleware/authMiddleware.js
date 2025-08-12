const authService = require('./../services/authServices');

const verifyToken = (token, secret) => {
    try {
        return jwt.verify(token, secret);
    } catch {
        return null;
    }
}

const validateToken = async (req, res, next) => {
    console.log('🔐 Validating User...');

    const token = req.header('Authorization'); // Header key should be 'Authorization'

    if (!token) {
        return res.status(401).json({ message: 'Access token missing' });
    }

    const result = authService.verifyAccessToken(token);

    if (!result.valid) {
        console.error('❌ Token verification failed:', result.error);
        return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = result.payload; // Pass the decoded payload to next routes
    return next();
};

module.exports = { validateToken };