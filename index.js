require('dotenv').config();
const express = require('express');
const path = require('path');
const appRoot = require('./utils/pathUtils');
const app = express();

const userRouter = require(path.join(appRoot, 'router', 'user.js'));
const orderRouter = require(path.join(appRoot, 'router', 'orders.js'));

app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
    console.log('Middleware requested');
    next();
});

app.use('/api/user', userRouter); //user apis
app.use('/api/order', orderRouter); //order apis

app.listen(process.env.PORT, () => {
    console.log('Server Started');
});
