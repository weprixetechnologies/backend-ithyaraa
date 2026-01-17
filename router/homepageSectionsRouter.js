const express = require('express');
const router = express.Router();
const homepageSectionsController = require('../controllers/homepageSectionsController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

// Public route - Get active sections (for frontend)
router.get('/active', homepageSectionsController.getActiveSections);

// Admin routes - All require authentication
router.post('/', authAdminMiddleware.verifyAccessToken, homepageSectionsController.createSection);
router.get('/', authAdminMiddleware.verifyAccessToken, homepageSectionsController.getAllSections);
router.get('/:id', authAdminMiddleware.verifyAccessToken, homepageSectionsController.getSectionByID);
router.put('/:id', authAdminMiddleware.verifyAccessToken, homepageSectionsController.updateSection);
router.delete('/:id', authAdminMiddleware.verifyAccessToken, homepageSectionsController.deleteSection);
router.patch('/:id/status', authAdminMiddleware.verifyAccessToken, homepageSectionsController.updateSectionStatus);

module.exports = router;
