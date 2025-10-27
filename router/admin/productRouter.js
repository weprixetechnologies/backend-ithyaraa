const express = require('express')
const productRouter = express.Router()
const productController = require('./../../controllers/productController')
const authAdminMiddleware = require('./../../middleware/authAdminMiddleware')

productRouter.post('/add-product', authAdminMiddleware.verifyAccessToken, productController.addProduct)
productRouter.post('/add-custom-product', authAdminMiddleware.verifyAccessToken, productController.addCustomProduct)
productRouter.post('/edit-product', authAdminMiddleware.verifyAccessToken, productController.editProduct)
productRouter.delete('/delete/:productID', authAdminMiddleware.verifyAccessToken, productController.deleteProduct)
productRouter.get('/all-products', productController.getPaginatedProducts)
productRouter.get('/count-product', authAdminMiddleware.verifyAccessToken, productController.getProductPageCount)
productRouter.get('/details/:productID', productController.getProductDetails);
// Public shop list
productRouter.get('/shop', productController.shopList);

module.exports = productRouter