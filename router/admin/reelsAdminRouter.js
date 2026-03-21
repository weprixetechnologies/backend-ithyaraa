const express = require('express');
const router = express.Router();
const reelsController = require('../../controllers/reelsController');

// All routes are prefixed with /api/admin/reels (in index.js)
router.post('/', reelsController.addReel);
router.get('/', reelsController.listReelsAdmin);
router.get('/:id', reelsController.getReelByID);
router.put('/:id', reelsController.updateReel);
router.delete('/:id', reelsController.deleteReel);
router.patch('/:id/status', reelsController.toggleStatus);
router.patch('/reorder', reelsController.reorderReels);

module.exports = router;
