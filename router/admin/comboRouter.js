const express = require('express');
const comboRouter = express.Router();
const comboController = require('../../controllers/comboController');
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware')


comboRouter.post('/create-combo', authAdminMiddleware.verifyAccessToken, comboController.createComboProduct);
comboRouter.get('/detail/:comboID', authAdminMiddleware.verifyAccessToken, comboController.getCombobyID);
comboRouter.put('/edit/:comboID', authAdminMiddleware.verifyAccessToken, comboController.editCombo);
comboRouter.delete('/delete/:comboID', authAdminMiddleware.verifyAccessToken, comboController.deleteComboController);


module.exports = comboRouter;
