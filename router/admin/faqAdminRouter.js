const express = require('express');
const router = express.Router();
const faqController = require('../../controllers/faqController');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

// Reorder must be before /:id so "reorder" is not treated as id
router.patch('/faqs/reorder', authAdminMiddleware.verifyAccessToken, faqController.reorder);

router.post('/faqs', authAdminMiddleware.verifyAccessToken, faqController.create);
router.get('/faqs', authAdminMiddleware.verifyAccessToken, faqController.list);
router.get('/faqs/:id', authAdminMiddleware.verifyAccessToken, faqController.getOne);
router.put('/faqs/:id', authAdminMiddleware.verifyAccessToken, faqController.update);
router.delete('/faqs/:id', authAdminMiddleware.verifyAccessToken, faqController.remove);
router.patch('/faqs/:id/toggle', authAdminMiddleware.verifyAccessToken, faqController.toggle);

module.exports = router;
