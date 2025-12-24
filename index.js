//EXTERNAL
require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors')

//Core Modules
const userRouter = require('./router/usersRouter')
const authRouter = require('./router/authRouter')
const cartRouter = require('./router/cartRouter')
const adminAuthRouter = require('./router/admin/authAdminRouter')
const userAdminRouter = require('./router/admin/userAdminRouter')
const productRouter = require('./router/admin/productRouter')
const brandAuthRouter = require('./router/brand/authBrandRouter')
const orderBrandRouter = require('./router/brand/orderBrandRouter')
const productBrandRouter = require('./router/brand/productBrandRouter')
const profileBrandRouter = require('./router/brand/profileBrandRouter')
const offerRouter = require('./router/admin/offerAdminRouter')
const categoryRouter = require('./router/admin/categoryRouter')
const commonRouter = require('./router/commonRouter')
const couponsRouter = require('./router/admin/couponsRouter')
const makeComboRouter = require('./router/admin/makeComboRouter')
const comboRouter = require('./router/admin/comboRouter')
const addressRouter = require('./router/addressRouter')
const giftcardRouter = require('./router/giftcardRouter')
const affiliateRouter = require('./router/affiliateRouter')
const wishlistRouter = require('./router/wishlistRouter')
const userCouponsRouter = require('./router/userCouponRouter')
const orderRouter = require('./router/orderRouter')
const phonepeRouter = require('./router/phonepeRouter')
const reviewRouter = require('./router/reviewRouter')
const coinRouter = require('./router/coinRouter')
const coinsAdminRouter = require('./router/admin/coinsAdminRouter')
const flashSaleAdminRouter = require('./router/admin/flashSaleRouter')
const adminDashboardRouter = require('./router/adminDashboardRouter')
const brandAdminRouter = require('./router/admin/brandAdminRouter')
const brandBankDetailsAdminRouter = require('./router/admin/brandBankDetailsAdminRouter')
const brandBankDetailsRouter = require('./router/brand/brandBankDetailsRouter')
const adminBrandOrdersRouter = require('./router/admin/adminBrandOrdersRouter')
const presaleProductRouter = require('./router/admin/presaleProductRouter')
const presaleDetailsRouter = require('./router/admin/presaleDetailsRouter')
const presaleBookingRouter = require('./router/admin/presaleBookingRouter')
const presaleRouter = require('./router/presaleRouter')
// CORS setup (replace with your actual frontend domain)

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/', commonRouter)
app.use('/api/user', userRouter); //user apis
app.use('/api/admin', userAdminRouter); //admin user management apis
app.use('/api/auth', authRouter)
app.use('/api/products', productRouter)
app.use('/api/offer', offerRouter)
app.use('/api/categories', categoryRouter)
app.use('/api/coupons', couponsRouter)
app.use('/api/make-combo', makeComboRouter)
app.use('/api/combo', comboRouter)
app.use('/api/address', addressRouter)
app.use('/api/giftcard', giftcardRouter)
app.use('/api/affiliate', affiliateRouter)
app.use('/api/wishlist', wishlistRouter)
app.use('/api/cart', cartRouter)
app.use('/api/user-coupon', userCouponsRouter)
app.use('/api/order', orderRouter)
app.use('/api/phonepe', phonepeRouter)
app.use('/api/reviews', reviewRouter)
app.use('/api/coins', coinRouter)
app.use('/api/presale', presaleRouter)

// ADMIN ROUTE - Register dashboard BEFORE adminAuthRouter to avoid conflicts
app.use('/api/admin', adminDashboardRouter);
app.use('/api/admin', brandAdminRouter);
app.use('/api/admin', brandBankDetailsAdminRouter);
app.use('/api/admin', adminBrandOrdersRouter);
app.use('/api/admin/flash-sales', flashSaleAdminRouter);
app.use('/api/admin/coins', coinsAdminRouter);
app.use('/api/admin/presale-products', presaleProductRouter);
app.use('/api/admin/presale-groups', presaleDetailsRouter);
app.use('/api/admin/presale-bookings', presaleBookingRouter);
app.use('/api/admin', adminAuthRouter);

// BRAND AUTH ROUTE
app.use('/api/brand', brandAuthRouter)
app.use('/api/brand', orderBrandRouter)
app.use('/api/brand', productBrandRouter)
app.use('/api/brand', brandBankDetailsRouter)
app.use('/api/brand', profileBrandRouter)

app.listen(process.env.PORT, () => {
  console.log('Server Started');
});

