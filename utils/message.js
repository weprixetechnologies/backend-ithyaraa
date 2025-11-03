const twilio = require('twilio')
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC0b7dcf4ab84fe14ddb17db27c08b2dcc';
const authToken = process.env.TWILIO_AUTH_TOKEN || '03b9bf35b5785e702d80af94a416721c';
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '+12347203560';

const client = twilio(accountSid, authToken);

module.exports = { client, twilioNumber };