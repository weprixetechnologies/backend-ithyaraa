const express = require('express')
const authRouter = express.Router()
const adminController = require('../../controllers/nouse')
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware')

authRouter.post('/register', adminController.adminAuthRegister)

authRouter.post('/login', (req, res) => {
})

module.exports = authRouter 