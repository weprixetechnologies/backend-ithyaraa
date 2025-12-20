const twilio = require('twilio')
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC0b7dcf4ab84fe14ddb17db27c08b2dcc';
const authToken = process.env.TWILIO_AUTH_TOKEN || '49432c8322ded624426f98a7d3a8c272';
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '+12347203560';

const client = twilio(accountSid, authToken);

module.exports = { client, twilioNumber };