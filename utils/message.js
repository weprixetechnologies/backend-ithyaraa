require('dotenv').config();

const twilio = require('twilio')

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC0b7dcf4ab84fe14ddb17db27c08b2dcc';
const authToken = process.env.TWILIO_AUTH_TOKEN || '0fc4b8f368730b8a524d206eae6e8c2c';
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '+12347203560';

const client = twilio(accountSid, authToken);

module.exports = { client, twilioNumber };