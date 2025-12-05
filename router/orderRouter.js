const express = require('express');
const orderController = require('../controllers/orderController.js');
const userAuth = require('../middleware/authUserMiddleware.js');

const router = express.Router();

// User routes
router.post('/place-order', userAuth.verifyAccessToken, orderController.placeOrderController);
router.get('/get-order-items', userAuth.verifyAccessToken, orderController.getOrderItemsByUidController);
router.get('/get-order-summaries', userAuth.verifyAccessToken, orderController.getOrderSummariesController);
router.get('/order-details/:orderID', userAuth.verifyAccessToken, orderController.getOrderDetailsByOrderIDController);
router.get('/order-details/:orderId', userAuth.verifyAccessToken, orderController.getOrderDetailsController);
router.put('/update/:orderID', userAuth.verifyAccessToken, orderController.updateOrderController);
router.get('/generate-invoice/:orderId', userAuth.verifyAccessToken, orderController.generateInvoiceForUserController);

// Admin routes
router.get('/admin/all', userAuth.verifyAccessToken, orderController.getAllOrdersController);
router.get('/admin/order-details/:orderId', userAuth.verifyAccessToken, orderController.getAdminOrderDetailsController);
router.put('/admin/update-status/:orderId', userAuth.verifyAccessToken, orderController.updateOrderStatusController);
router.put('/admin/update-payment-status/:orderId', userAuth.verifyAccessToken, orderController.updatePaymentStatusController);
router.put('/admin/update-items-tracking/:orderId', userAuth.verifyAccessToken, orderController.updateOrderItemsTrackingController);
router.get('/admin/generate-invoice/:orderId', userAuth.verifyAccessToken, orderController.generateInvoiceController);
router.post('/admin/email-invoice/:orderId', userAuth.verifyAccessToken, orderController.emailInvoiceController);

module.exports = router;
