const express = require('express')
const productBrandRouter = express.Router()
const brandProductController = require('./../../controllers/brandProductController')
const authBrandMiddleware = require('./../../middleware/authBrandMiddleware')

// Add product (brand-specific)
productBrandRouter.post('/add-product', authBrandMiddleware.verifyAccessToken, brandProductController.addBrandProduct)

// Edit product (brand-specific)
productBrandRouter.post('/edit-product', authBrandMiddleware.verifyAccessToken, brandProductController.editBrandProduct)

// Delete product (brand-specific)
productBrandRouter.delete('/delete/:productID', authBrandMiddleware.verifyAccessToken, brandProductController.deleteBrandProduct)

// Get all products for this brand
productBrandRouter.get('/all-products', authBrandMiddleware.verifyAccessToken, brandProductController.getBrandProducts)

// Get product count for this brand
productBrandRouter.get('/count-product', authBrandMiddleware.verifyAccessToken, brandProductController.getBrandProductCount)

// Get product details (brand-specific)
productBrandRouter.get('/details/:productID', authBrandMiddleware.verifyAccessToken, brandProductController.getBrandProductDetails)

module.exports = productBrandRouter
