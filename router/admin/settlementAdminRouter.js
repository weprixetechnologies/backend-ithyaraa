const express = require('express');
const router = express.Router();
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');
const db = require('../../utils/dbconnect');
const {
  computeSettlement,
  lockSettlement,
  recordSettlementPayment,
} = require('../../services/settlementService');
const ctrl = require('../../controllers/settlementController');

// MUST be registered before /:brandID/:month to avoid route conflict
router.get(
  '/settlements/brands-overview',
  authAdminMiddleware.verifyAccessToken,
  ctrl.getBrandsOverview
);

// GET /settlements list
router.get(
  '/settlements',
  authAdminMiddleware.verifyAccessToken,
  ctrl.listSettlements
);

// GET /settlements/:id/payments
router.get(
  '/settlements/:id/payments',
  authAdminMiddleware.verifyAccessToken,
  ctrl.getPaymentHistory
);

// GET /settlements/:brandID/:month
router.get(
  '/settlements/:brandID/:month',
  authAdminMiddleware.verifyAccessToken,
  ctrl.getSettlementDetail
);

// POST /settlements/:brandID/:month/lock
router.post(
  '/settlements/:brandID/:month/lock',
  authAdminMiddleware.verifyAccessToken,
  ctrl.lockSettlement
);

router.put('/settlements/:id/approve', authAdminMiddleware.verifyAccessToken, async (req, res) => {
  try {
    const { id } = req.params;
    const adminID = req.user && req.user.uid;
    await db.query(
      `UPDATE brand_settlements 
       SET status = 'approved', approvedAt = NOW() 
       WHERE id = ?`,
      [id]
    );
    res.json({ success: true, data: { id, status: 'approved', approvedBy: adminID } });
  } catch (err) {
    console.error('Error approving settlement', err);
    res.status(500).json({ success: false, message: 'Failed to approve settlement', error: err.message });
  }
});

// POST /settlements/:id/payment
router.post(
  '/settlements/:id/payment',
  authAdminMiddleware.verifyAccessToken,
  ctrl.recordPayment
);

router.put('/settlements/:id/dispute', authAdminMiddleware.verifyAccessToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};
    await db.query(
      `UPDATE brand_settlements 
       SET status = 'disputed', notes = ? 
       WHERE id = ?`,
      [notes || null, id]
    );
    res.json({ success: true, data: { id, status: 'disputed', notes: notes || null } });
  } catch (err) {
    console.error('Error marking settlement disputed', err);
    res.status(500).json({ success: false, message: 'Failed to mark settlement disputed', error: err.message });
  }
});

router.get('/settlements/:id/items', authAdminMiddleware.verifyAccessToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT oi.*
       FROM order_items oi
       WHERE oi.settlementID = ?`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching settlement items', err);
    res.status(500).json({ success: false, message: 'Failed to fetch settlement items', error: err.message });
  }
});

module.exports = router;

