const express = require('express');
const commonRouter = express.Router();
const commonController = require('../controllers/index');


commonRouter.get('/count', commonController.getCountController);

module.exports = commonRouter;
