require('dotenv').config();

const express = require('express')

const app = express();
const user = require('./router/user')

app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
    console.log('Middleware requested');
    next();
})


app.use('/user', user)

app.listen(process.env.PORT, () => {
    console.log('Server Started')
})