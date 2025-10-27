const express = require('express');
const addressRouter = express.Router();
const addressController = require('../controllers/addressController');
const authMiddleware = require('./../middleware/authUserMiddleware')

addressRouter.post('/add-address', authMiddleware.verifyAccessToken, addressController.postAddress);
addressRouter.get('/all-address', authMiddleware.verifyAccessToken, addressController.getAddresses);
addressRouter.delete('/:addressID', authMiddleware.verifyAccessToken, addressController.deleteAddress);

module.exports = addressRouter;
