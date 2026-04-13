const jwt = require('jsonwebtoken')

const verifyAccessToken = (req, res, next) => {
    try {
        const authHeader = req.headers?.authorization

        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Access token missing. Please login." })
        }

        const token = authHeader.split(" ")[1]

        const decoded = jwt.verify(token, process.env.JWT_BRAND_SECRET)

        req.user = decoded

        next()
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Access token expired. Please refresh token." })
        }
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Invalid token." })
        }
        return res.status(500).json({ message: "Authentication error." })
    }
}

module.exports = { verifyAccessToken }