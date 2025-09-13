const express = require('express');
const makeComboRouter = express.Router();
const makeComboController = require('./../../controllers/makeComboController');
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware')

makeComboRouter.post('/create-make-combo', authAdminMiddleware.verifyAccessToken, makeComboController.createComboProduct)
makeComboRouter.get('/detail/:comboID', authAdminMiddleware.verifyAccessToken, makeComboController.getComboDetailsController);
makeComboRouter.put('/edit/:comboID', authAdminMiddleware.verifyAccessToken, makeComboController.editComboProduct);

// User-facing endpoint (no auth required)
makeComboRouter.get('/detail-user/:productID', makeComboController.getComboDetailsForUserController);

module.exports = makeComboRouter