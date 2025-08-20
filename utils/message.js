const twilio = require('twilio')

const accountSid = 'AC0b7dcf4ab84fe14ddb17db27c08b2dcc';
const authToken = '0f5d6ea86709bb49b318225de427def2';
const twilioNumber = '+12347203560';
const client = twilio(accountSid, authToken);

module.exports = { client, twilioNumber };