const express = require('express')
const productRouter = express.Router()
const productController = require('./../../controllers/productController')

productRouter.post('/add-product', productController.addProduct)

module.exports = productRouter