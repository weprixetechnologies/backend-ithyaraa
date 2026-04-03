require('dotenv').config();

const twilio = require('twilio')

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC0b7dcf4ab84fe14ddb17db27c08b2dcc';
const authToken = process.env.TWILIO_AUTH_TOKEN || '27995709e9376ad51bcdbb193ca01a79';
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '+12347203560';

const client = twilio(accountSid, authToken);

module.exports = { client, twilioNumber };