const express = require('express')

const user = express.Router()

user.get('/', (req, res) => {
    console.log('User Request');
    return res.send('Request Ended')
})
module.exports = user