const express = require('express');
const orderController = require('../controllers/orderController.js');
const userAuth = require('../middleware/authUserMiddleware.js');
const authAdminMiddleware = require('../middleware/authAdminMiddleware.js');

const router = express.Router();

// User routes
router.post('/place-order', userAuth.verifyAccessToken, orderController.placeOrderController);
router.get('/get-order-items', userAuth.verifyAccessToken, orderController.getOrderItemsByUidController);
router.get('/get-order-summaries', userAuth.verifyAccessToken, orderController.getOrderSummariesController);
router.get('/order-details/:orderID', userAuth.verifyAccessToken, orderController.getOrderDetailsByOrderIDController);
router.get('/my-returns', userAuth.verifyAccessToken, orderController.getMyReturnsController);
router.post('/return-order', userAuth.verifyAccessToken, orderController.returnOrderController);
// router.get('/order-details/:orderId', userAuth.verifyAccessToken, orderController.getOrderDetailsController);
router.put('/update/:orderID', userAuth.verifyAccessToken, orderController.updateOrderController);
router.get('/generate-invoice/:orderId', userAuth.verifyAccessToken, orderController.generateInvoiceForUserController);
router.post('/email-invoice/:orderId', userAuth.verifyAccessToken, orderController.emailInvoiceToCustomerController);

// Admin routes
router.get('/admin/all', authAdminMiddleware.verifyAccessToken, orderController.getAllOrdersController);
router.get('/admin/order-details/:orderId', authAdminMiddleware.verifyAccessToken, orderController.getAdminOrderDetailsController);
router.get('/admin/refund-queries', authAdminMiddleware.verifyAccessToken, orderController.getRefundQueriesController);
router.put('/admin/refund-queries/:refundQueryID/status', authAdminMiddleware.verifyAccessToken, orderController.updateRefundQueryStatusController);
router.put('/admin/update-status/:orderId', authAdminMiddleware.verifyAccessToken, orderController.updateOrderStatusController);
router.put('/admin/update-payment-status/:orderId', authAdminMiddleware.verifyAccessToken, orderController.updatePaymentStatusController);
router.put('/admin/update-items-tracking/:orderId', authAdminMiddleware.verifyAccessToken, orderController.updateOrderItemsTrackingController);
router.get('/admin/generate-invoice/:orderId', authAdminMiddleware.verifyAccessToken, orderController.generateInvoiceController);
router.post('/admin/email-invoice/:orderId', authAdminMiddleware.verifyAccessToken, orderController.emailInvoiceController);

module.exports = router;
