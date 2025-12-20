// Load environment variables
require('dotenv').config();

// Core modules
const fs = require('fs');
const https = require('https');
const express = require('express');
const cors = require('cors');

// Initialize app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routers
const userRouter = require('./router/usersRouter');
const authRouter = require('./router/authRouter');
const cartRouter = require('./router/cartRouter');
const adminAuthRouter = require('./router/admin/authAdminRouter');
const userAdminRouter = require('./router/admin/userAdminRouter');
const productRouter = require('./router/admin/productRouter');
const brandAuthRouter = require('./router/brand/authBrandRouter');
const orderBrandRouter = require('./router/brand/orderBrandRouter');
const productBrandRouter = require('./router/brand/productBrandRouter');
const offerRouter = require('./router/admin/offerAdminRouter');
const categoryRouter = require('./router/admin/categoryRouter');
const commonRouter = require('./router/commonRouter');
const couponsRouter = require('./router/admin/couponsRouter');
const makeComboRouter = require('./router/admin/makeComboRouter');
const comboRouter = require('./router/admin/comboRouter');
const addressRouter = require('./router/addressRouter');
const giftcardRouter = require('./router/giftcardRouter');
const affiliateRouter = require('./router/affiliateRouter');
const wishlistRouter = require('./router/wishlistRouter');
const userCouponsRouter = require('./router/userCouponRouter');
const orderRouter = require('./router/orderRouter');
const phonepeRouter = require('./router/phonepeRouter');
const reviewRouter = require('./router/reviewRouter');
const adminDashboardRouter = require('./router/adminDashboardRouter');
const brandAdminRouter = require('./router/admin/brandAdminRouter');
const brandBankDetailsAdminRouter = require('./router/admin/brandBankDetailsAdminRouter');
const brandBankDetailsRouter = require('./router/brand/brandBankDetailsRouter');

// Register routes
app.use('/api/', commonRouter);
app.use('/api/user', userRouter);
app.use('/api/admin', userAdminRouter);
app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/offer', offerRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/make-combo', makeComboRouter);
app.use('/api/combo', comboRouter);
app.use('/api/address', addressRouter);
app.use('/api/giftcard', giftcardRouter);
app.use('/api/affiliate', affiliateRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/cart', cartRouter);
app.use('/api/user-coupon', userCouponsRouter);
app.use('/api/order', orderRouter);
app.use('/api/phonepe', phonepeRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/admin', adminDashboardRouter);
app.use('/api/admin', brandAdminRouter);
app.use('/api/admin', brandBankDetailsAdminRouter);
app.use('/api/admin', adminAuthRouter);
app.use('/api/brand', brandAuthRouter);
app.use('/api/brand', orderBrandRouter);
app.use('/api/brand', productBrandRouter);
app.use('/api/brand', brandBankDetailsRouter);

// ✅ HTTPS setup using Let's Encrypt certificate
const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/backend.ithyaraa.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/backend.ithyaraa.com/fullchain.pem')
};

// Start HTTPS server
https.createServer(sslOptions, app).listen(process.env.PORT || 8800, () => {
  console.log('✅ HTTPS Server running on port', process.env.PORT || 8800);
});
