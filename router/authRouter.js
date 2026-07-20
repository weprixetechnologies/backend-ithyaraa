const express = require('express')
const authController = require('./../controllers/authController')
const rateLimiter = require('../middlewares/rateLimiter')

const authRouter = express.Router();

authRouter.post("/register", rateLimiter(5, 60), authController.register);
authRouter.post("/login", rateLimiter(5, 60), authController.login);
authRouter.post('/refresh-token', authController.refreshToken)

module.exports = authRouter
