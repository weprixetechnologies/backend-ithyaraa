const express = require('express')
const authRouter = express.Router()
const adminController = require('./../../controllers/adminAuthController')
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware')

authRouter.post('/register', authAdminMiddleware.isRegistered, adminController.adminAuthRegister)

authRouter.post('/login', (req, res) => {

})

module.exports = authRouter 