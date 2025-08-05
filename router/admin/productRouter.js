const express = require('express')
const productRouter = express.Router()
const productController = require('./../../controllers/productController')

productRouter.post('/add-product', productController.addProduct)
productRouter.post('/edit-product', productController.editProduct)
productRouter.get('/all-products', productController.getPaginatedProducts)
productRouter.get('/count-product', productController.getProductPageCount)
productRouter.get('/details/:productID', productController.getProductDetails);

module.exports = productRouter