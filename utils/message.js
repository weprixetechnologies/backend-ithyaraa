require('dotenv').config();

const twilio = require('twilio')

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC0b7dcf4ab84fe14ddb17db27c08b2dcc';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'f5ff93250065357cfe98b903c37d5fdb';
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '+12347203560';

const client = twilio(accountSid, authToken);

module.exports = { client, twilioNumber };