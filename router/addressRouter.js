const express = require('express');
const addressRouter = express.Router();
const addressController = require('../controllers/addressController');
const authMiddleware = require('./../middleware/authAdminMiddleware')

addressRouter.post('/add-address', authMiddleware.verifyAccessToken, addressController.postAddress);

module.exports = addressRouter;
