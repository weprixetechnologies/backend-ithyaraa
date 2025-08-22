// src/utils/crypto.js
const crypto = require('crypto');
const argon2 = require('argon2');

const CARD_DIGITS = 16;
const PIN_DIGITS = 6;

/** Generate secure numeric string of given length (no modulo bias). */
async function secureDigits(len) {
    // crypto.randomInt(0,10) is unbiased and secure
    const digits = await Promise.all(
        Array.from({ length: len }, () => crypto.randomInt(0, 10))
    );
    return digits.join('');
}

/** HMAC-SHA256 hex for deterministic, secret-keyed hashing (card number). */
function hmacCardNumber(number) {
    const key = process.env.CARD_HMAC_SECRET;
    if (!key) throw new Error('CARD_HMAC_SECRET not set');
    return crypto.createHmac('sha256', key).update(number, 'utf8').digest('hex');
}

/** Hash PIN (argon2) */
async function hashPin(pin) {
    return argon2.hash(pin, {
        type: argon2.argon2id,
        memoryCost: Number(process.env.ARGON_MEMORY) || 19456,
        timeCost: Number(process.env.ARGON_ITERATIONS) || 2,
        parallelism: Number(process.env.ARGON_PARALLELISM) || 1,
    });
}

/** Verify PIN */
async function verifyPin(pin, pinHash) {
    return argon2.verify(pinHash, pin);
}

module.exports = {
    CARD_DIGITS,
    PIN_DIGITS,
    secureDigits,
    hmacCardNumber,
    hashPin,
    verifyPin,
};
