const express = require('express');
const router = express.Router();
const authBrandMiddleware = require('../../middleware/authBrandMiddleware');
const db = require('../../utils/dbconnect');

router.get('/settlements', authBrandMiddleware.verifyAccessToken, async (req, res) => {
  try {
    const brandID = req.user.uid;
    const { month } = req.query;

    const where = ['brandID = ?'];
    const params = [brandID];
    if (month) {
      where.push('settlementMonth = ?');
      params.push(month);
    }

    const [rows] = await db.query(
      `SELECT *
       FROM brand_settlements
       WHERE ${where.join(' AND ')}
       ORDER BY periodStart DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing brand settlements', err);
    res.status(500).json({ success: false, message: 'Failed to list settlements', error: err.message });
  }
});

router.get('/settlements/:id', authBrandMiddleware.verifyAccessToken, async (req, res) => {
  try {
    const brandID = req.user.uid;
    const { id } = req.params;

    const [settlementRows] = await db.query(
      `SELECT * FROM brand_settlements WHERE id = ? AND brandID = ? LIMIT 1`,
      [id, brandID]
    );
    if (!settlementRows || settlementRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    const [items] = await db.query(
      `SELECT oi.*
       FROM order_items oi
       WHERE oi.settlementID = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        settlement: settlementRows[0],
        items,
      },
    });
  } catch (err) {
    console.error('Error fetching brand settlement detail', err);
    res.status(500).json({ success: false, message: 'Failed to fetch settlement', error: err.message });
  }
});

module.exports = router;

