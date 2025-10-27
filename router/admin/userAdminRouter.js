const express = require('express');
const userAdminRouter = express.Router();
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');
const usersController = require('../../controllers/usersController');
const addressService = require('../../services/addressService');

// Admin user management routes
userAdminRouter.get('/users', authAdminMiddleware.verifyAccessToken, usersController.getAllUsers);
userAdminRouter.get('/users/:uid', authAdminMiddleware.verifyAccessToken, usersController.getUserByUID);
userAdminRouter.put('/users/:uid', authAdminMiddleware.verifyAccessToken, usersController.updateUserByUID);
userAdminRouter.delete('/users/:uid', authAdminMiddleware.verifyAccessToken, usersController.deleteUserByUID);
userAdminRouter.get('/users/:uid/orders', authAdminMiddleware.verifyAccessToken, usersController.getUserOrders);

// Get user addresses by UID (Admin)
userAdminRouter.get('/users/:uid/addresses', authAdminMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { uid } = req.params;
        console.log('Fetching addresses for UID:', uid);

        const addresses = await addressService.getAddresses(uid, null);
        console.log('Addresses found:', addresses);

        res.status(200).json({
            success: true,
            data: addresses
        });
    } catch (error) {
        console.error('Error fetching user addresses:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch addresses',
            error: error.message
        });
    }
});

// Admin verification management routes
userAdminRouter.post('/users/:uid/remove-phone-verification', authAdminMiddleware.verifyAccessToken, usersController.removePhoneVerification);
userAdminRouter.post('/users/:uid/remove-email-verification', authAdminMiddleware.verifyAccessToken, usersController.removeEmailVerification);
userAdminRouter.post('/users/:uid/send-verification-email', authAdminMiddleware.verifyAccessToken, usersController.sendAdminVerificationEmail);
userAdminRouter.post('/users/:uid/send-phone-verification-otp', authAdminMiddleware.verifyAccessToken, usersController.sendAdminPhoneVerificationOtp);

module.exports = userAdminRouter;
