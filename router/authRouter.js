const express = require('express')
const authRouter = express.Router()
const authControllers = require('./../controllers/authController')
const authMiddleware = require('./../middleware/authMiddleware')


authRouter.post('/validate', authMiddleware.validateToken, (req, res) => {
    return res.json({ message: 'You are Allowed' })
})
authRouter.post('/register', authControllers.registerUser)
authRouter.post('/login', authControllers.loginUser)
authRouter.post('/refresh-token', authControllers.refreshTokenController)

module.exports = authRouter