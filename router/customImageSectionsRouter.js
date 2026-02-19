const express = require('express');
const router = express.Router();
const customController = require('../controllers/customImageSectionsController');
const imagesController = require('../controllers/sectionImagesController');
const authAdminMiddleware = require('../middleware/authAdminMiddleware');

// Sections CRUD
router.post('/', authAdminMiddleware.verifyAccessToken, customController.createSection);
router.get('/', authAdminMiddleware.verifyAccessToken, customController.listSections);
router.get('/:id', authAdminMiddleware.verifyAccessToken, customController.getSection);
router.put('/:id', authAdminMiddleware.verifyAccessToken, customController.updateSection);
router.delete('/:id', authAdminMiddleware.verifyAccessToken, customController.deleteSection);

// Images under a section
router.post('/:sectionID/images', authAdminMiddleware.verifyAccessToken, imagesController.addImages);
router.get('/:sectionID/images', authAdminMiddleware.verifyAccessToken, imagesController.listImages);
router.put('/images/:id', authAdminMiddleware.verifyAccessToken, imagesController.updateImage);
router.delete('/images/:id', authAdminMiddleware.verifyAccessToken, imagesController.deleteImage);

module.exports = router;

