const express = require('express')

const order = express.Router()

order.get('/', (req, res) => {
    console.log('order Request');
    return res.send('Request Ended')

})
module.exports = order