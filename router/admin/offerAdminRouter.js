const express = require('express')
const offerRouter = express.Router()
const controller = require('./../../controllers/offersController')

offerRouter.get('/search-by-name', controller.fetchOfferbyName)


module.exports = offerRouter