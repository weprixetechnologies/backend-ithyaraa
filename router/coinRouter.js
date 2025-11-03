const express = require('express');
const router = express.Router();
const userAuth = require('../middleware/authUserMiddleware.js');
const coinModel = require('../model/coinModel');

// Require auth only; rely on migrations for schema
router.use(userAuth.verifyAccessToken);

router.get('/balance', async (req, res) => {
    try {
        const uid = req.user.uid;
        const balance = await coinModel.getBalance(uid);
        return res.json({ success: true, balance });
    } catch (e) {
        console.error('coin balance error', e);
        return res.status(500).json({ success: false, message: 'Failed to fetch balance' });
    }
});

router.get('/history', async (req, res) => {
    try {
        const uid = req.user.uid;
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '20', 10);
        const data = await coinModel.getHistory(uid, page, limit);
        return res.json({ success: true, ...data });
    } catch (e) {
        console.error('coin history error', e);
        return res.status(500).json({ success: false, message: 'Failed to fetch history' });
    }
});

router.post('/redeem', async (req, res) => {
    try {
        const uid = req.user.uid;
        const coins = parseInt(req.body?.coins || 0, 10);
        if (!coins || coins <= 0) return res.status(400).json({ success: false, message: 'Invalid coins' });
        await coinModel.redeemCoinsToWallet(uid, coins);
        return res.json({ success: true, message: 'Coins redeemed to wallet' });
    } catch (e) {
        console.error('coin redeem error', e);
        return res.status(400).json({ success: false, message: e.message || 'Failed to redeem coins' });
    }
});

module.exports = router;


