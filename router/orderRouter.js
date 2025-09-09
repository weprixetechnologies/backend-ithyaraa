const express = require('express');
const orderController = require('../controllers/orderController.js');
const userAuth = require('../middleware/authAdminMiddleware.js');

const router = express.Router();

router.post('/place-order', userAuth.verifyAccessToken, orderController.placeOrderController);
router.get('/get-order-items', userAuth.verifyAccessToken, orderController.getOrderItemsByUidController);
router.put('/update/:orderID', userAuth.verifyAccessToken, orderController.updateOrderController);

module.exports = router;
