const express = require('express')
const offerRouter = express.Router()
const controller = require('./../../controllers/offersController')
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware')

// Public routes (no auth required)
offerRouter.get('/public', controller.getOffers)
offerRouter.get('/public/:offerID', controller.getOfferDetails)

// Admin routes (auth required)
offerRouter.get('/search-by-name', authAdminMiddleware.verifyAccessToken, controller.fetchOfferbyName)
offerRouter.post('/add-offer', authAdminMiddleware.verifyAccessToken, controller.postOfferController)
offerRouter.get('/all-offers', authAdminMiddleware.verifyAccessToken, controller.getOffers)
offerRouter.get('/count', authAdminMiddleware.verifyAccessToken, controller.getOfferCount)
offerRouter.put('/edit-offer/:offerID', authAdminMiddleware.verifyAccessToken, controller.editOffer)
offerRouter.get('/detail/:offerID', authAdminMiddleware.verifyAccessToken, controller.getOfferDetails);

module.exports = offerRouter