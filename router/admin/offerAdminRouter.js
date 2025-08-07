const express = require('express')
const offerRouter = express.Router()
const controller = require('./../../controllers/offersController')

offerRouter.get('/search-by-name', controller.fetchOfferbyName)
offerRouter.post('/add-offer', controller.postOfferController)
offerRouter.get('/all-offers', controller.getOffers)
offerRouter.get('/count', controller.getOfferCount)
offerRouter.put('/edit-offer/:offerID', controller.editOffer)
offerRouter.get('/detail/:offerID', controller.getOfferDetails);

module.exports = offerRouter