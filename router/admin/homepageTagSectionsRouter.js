const express = require('express');
const router = express.Router();
const controller = require('../../controllers/homepageTagSectionsController');

// Public route - Get active sections with products (for frontend)
router.get('/active', controller.getActiveTagSections);

router.get('/', controller.getAllTagSections);
router.post('/', controller.createTagSection);
router.put('/:id', controller.updateTagSection);
router.delete('/:id', controller.deleteTagSection);

router.get('/:tag/products', controller.getSectionProducts);
router.post('/:tag/bulk-tag', controller.bulkAddTag);
router.post('/:tag/bulk-untag', controller.bulkRemoveTag);

module.exports = router;
