// src/models/giftcard.model.js
const db = require('../utils/dbconnect');

async function insertGiftCard({ card_number_hmac, card_last4, pin_hash, currency, balance, status, expires_at, created_by, metadata }) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.execute(
            `INSERT INTO giftcards
        (card_number_hmac, card_last4, pin_hash, currency, balance, status, expires_at, created_by, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                card_number_hmac,
                card_last4,
                pin_hash,
                currency,
                balance,
                status,
                expires_at,
                created_by || null,
                metadata ? JSON.stringify(metadata) : null,
            ]
        );
        await conn.commit();
        return result.insertId;
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}

/** Check if a card HMAC already exists (uniqueness). */
async function existsByCardHmac(card_number_hmac) {
    const [rows] = await db.execute(
        `SELECT id FROM giftcards WHERE card_number_hmac = ? LIMIT 1`,
        [card_number_hmac]
    );
    return rows.length > 0;
}


async function findGiftCardByNumberHmac(card_number_hmac) {
    const [rows] = await db.execute(
        `SELECT * FROM giftcards WHERE card_number_hmac = ? LIMIT 1`,
        [card_number_hmac]
    );
    return rows[0] || null;
}

async function markGiftCardRedeemed(giftcardId, redeemedByEmail, redeemedByUid) {
    await db.execute(
        `UPDATE giftcards 
     SET status='redeemed',
         metadata = JSON_SET(
            COALESCE(metadata, '{}'), 
            '$.redeemedBy', JSON_OBJECT('email', ?, 'uid', ?),
            '$.redeemedAt', NOW()
         )
     WHERE id=?`,
        [redeemedByEmail, redeemedByUid, giftcardId]
    );
}
module.exports = {
    insertGiftCard,
    existsByCardHmac,
    markGiftCardRedeemed, findGiftCardByNumberHmac
};
