// src/services/giftcard.service.js
const { CARD_DIGITS, PIN_DIGITS, secureDigits, hmacCardNumber, hashPin, verifyPin } = require('../utils/giftcardUtil')
const giftcard = require('../model/giftcardModel');
const User = require('./../model/usersModel')
async function generateUniqueCardNumber() {
    // Try multiple times in the unlikely case of collision
    for (let i = 0; i < 5; i++) {
        const number = await secureDigits(CARD_DIGITS);
        // Optional: ensure first digit non-zero (if you want)
        if (number[0] === '0') continue;

        const hmac = hmacCardNumber(number);
        const exists = await giftcard.existsByCardHmac(hmac);
        if (!exists) return { number, hmac };
    }
    throw new Error('Failed to generate unique card number');
}

/**
 * Create a new gift card.
 * Input: { amount (balance), currency, expiresAt (optional), createdBy (optional), metadata (optional) }
 * Output: { id, cardLast4, fullCardNumber (show once), pin (show once) }
 */
async function createGiftCard({ amount, currency = 'INR', expiresAt = null, createdBy = null, metadata = null }) {
    if (typeof amount !== 'number' || amount < 0) {
        const err = new Error('Invalid amount');
        err.status = 400;
        throw err;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
        const err = new Error('Invalid currency (use 3-letter code)');
        err.status = 400;
        throw err;
    }

    // 1) Generate secure values
    const { number: fullCardNumber, hmac: card_number_hmac } = await generateUniqueCardNumber();
    const pin = await secureDigits(PIN_DIGITS);
    const pin_hash = await hashPin(pin);

    // 2) Persist
    const newId = await giftcard.insertGiftCard({
        card_number_hmac,
        card_last4: fullCardNumber.slice(-4),
        pin_hash,
        currency,
        balance: amount,
        status: 'active',
        expires_at: expiresAt,
        created_by: createdBy,
        metadata,
    });

    // 3) Return only safe view; expose fullCardNumber & pin ONCE
    return {
        id: newId,
        currency,
        balance: amount,
        cardLast4: fullCardNumber.slice(-4),
        fullCardNumber, // show once (do not log!)
        pin,            // show once (do not log!)
        expiresAt,
        status: 'active',
    };
}

async function verifyAndRedeemGiftCard({ cardNumber, pin, user }) {
    if (!cardNumber || cardNumber.length !== 16 || !/^\d{16}$/.test(cardNumber)) {
        const err = new Error('Invalid card number');
        err.status = 400;
        throw err;
    }
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
        const err = new Error('Invalid PIN');
        err.status = 400;
        throw err;
    }

    const cardHmac = hmacCardNumber(cardNumber);
    const card = await giftcard.findGiftCardByNumberHmac(cardHmac);
    if (!card) {
        const err = new Error('Gift card not found');
        err.status = 404;
        throw err;
    }

    if (card.status !== 'active') {
        const err = new Error('Gift card is not active');
        err.status = 400;
        throw err;
    }
    if (card.expires_at && new Date(card.expires_at) < new Date()) {
        const err = new Error('Gift card has expired');
        err.status = 400;
        throw err;
    }

    const validPin = await verifyPin(pin, card.pin_hash);
    if (!validPin) {
        const err = new Error('Invalid PIN');
        err.status = 400;
        throw err;
    }

    // Step 1: Credit balance to user
    await User.creditUserBalance(user.uid, Number(card.balance));

    // Step 2: Mark card as redeemed
    await giftcard.markGiftCardRedeemed(card.id, user.emailID, user.uid);

    return { credited: Number(card.balance), currency: card.currency };
}



module.exports = {
    createGiftCard, verifyAndRedeemGiftCard
};
