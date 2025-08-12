const express = require('express')
const productRouter = express.Router()
const productController = require('./../../controllers/productController')
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware')

productRouter.post('/add-product', authAdminMiddleware.verifyAccessToken, productController.addProduct)
productRouter.post('/edit-product', authAdminMiddleware.verifyAccessToken, productController.editProduct)
productRouter.get('/all-products', authAdminMiddleware.verifyAccessToken, productController.getPaginatedProducts)
productRouter.get('/count-product', authAdminMiddleware.verifyAccessToken, productController.getProductPageCount)
productRouter.get('/details/:productID', authAdminMiddleware.verifyAccessToken, productController.getProductDetails);

module.exports = productRouter