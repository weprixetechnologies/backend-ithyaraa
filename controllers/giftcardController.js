// src/controllers/giftcard.controller.js
const giftcardService = require('../services/giftcardService');

async function createGiftCard(req, res) {
    try {
        const { amount, currency, expiresAt, metadata } = req.body || {};
        // Optionally use req.user.id if you have auth middleware
        const createdBy = req.user?.id || null;

        const gc = await giftcardService.createGiftCard({
            amount: Number(amount),
            currency,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            createdBy,
            metadata,
        });

        // Security: never log gc.fullCardNumber or gc.pin
        return res.status(201).json({
            success: true,
            data: {
                id: gc.id,
                currency: gc.currency,
                balance: gc.balance,
                status: gc.status,
                expiresAt: gc.expiresAt,
                // Reveal once:
                card: {
                    last4: gc.cardLast4,
                    full: gc.fullCardNumber,
                },
                pin: gc.pin,
            },
        });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({
            success: false,
            message: err.message || 'Internal Server Error',
        });
    }
}


async function verifyGiftCard(req, res) {
    try {
        const { cardNumber, pin } = req.body || {};
        const user = { emailID: req.user?.emailID, uid: req.user?.uid };
        if (!user.uid || !user.emailID) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const result = await giftcardService.verifyAndRedeemGiftCard({ cardNumber, pin, user });
        return res.status(200).json({
            success: true,
            message: 'Gift card redeemed successfully',
            data: {
                amountCredited: result.credited,
                currency: result.currency,
                walletUid: user.uid,
            },
        });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({
            success: false,
            message: err.message || 'Internal Server Error',
        });
    }
}



module.exports = {
    createGiftCard, verifyGiftCard
};
