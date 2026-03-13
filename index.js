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
const settlementAdminRouter = require('./router/admin/settlementAdminRouter')
const settlementBrandRouter = require('./router/brand/settlementBrandRouter')
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
const buyNowRouter = require('./router/buyNowRouter')
const phonepeRouter = require('./router/phonepeRouter')
const reviewRouter = require('./router/reviewRouter')
const coinRouter = require('./router/coinRouter')
const coinsAdminRouter = require('./router/admin/coinsAdminRouter')
const flashSaleAdminRouter = require('./router/admin/flashSaleRouter')
const adminDashboardRouter = require('./router/adminDashboardRouter')
const brandAdminRouter = require('./router/admin/brandAdminRouter')
const brandBankDetailsAdminRouter = require('./router/admin/brandBankDetailsAdminRouter')
const brandBankDetailsRouter = require('./router/brand/brandBankDetailsRouter')
const notificationAdminRouter = require('./router/admin/notificationAdminRouter')
const notificationBrandRouter = require('./router/brand/notificationBrandRouter')
const adminBrandOrdersRouter = require('./router/admin/adminBrandOrdersRouter')
const presaleProductRouter = require('./router/admin/presaleProductRouter')
const presaleDetailsRouter = require('./router/admin/presaleDetailsRouter')
const presaleBookingRouter = require('./router/admin/presaleBookingRouter')
const presaleRouter = require('./router/presaleRouter')
const homepageSectionsRouter = require('./router/homepageSectionsRouter')
const productGroupsRouter = require('./router/productGroupsRouter')
const newsletterRouter = require('./router/newsletterRouter')
const newsletterAdminRouter = require('./router/admin/newsletterAdminRouter')
const newsletterController = require('./controllers/newsletterController')
const sizeChartRouter = require('./router/sizeChartRouter')
const faqAdminRouter = require('./router/admin/faqAdminRouter')
const affiliateAdminRouter = require('./router/admin/affiliateAdminRouter')
const publicFaqRouter = require('./router/publicFaqRouter')
// CORS setup (replace with your actual frontend domain)

app.use(cors())

// JSON body parser for all routes EXCEPT PhonePe webhooks,
// which require the raw body for signature verification.
const jsonParser = express.json({ limit: '10mb' });
app.use((req, res, next) => {
  const url = req.originalUrl || '';

  // Skip JSON parsing for PhonePe webhook endpoints so that
  // they can access the raw request body as a Buffer.
  if (
    url.startsWith('/api/phonepe/webhook/order') ||
    url.startsWith('/api/phonepe/webhook/presale')
  ) {
    return next();
  }

  return jsonParser(req, res, next);
});

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
app.use('/api/order', buyNowRouter)
app.use('/api/phonepe', phonepeRouter)
app.use('/api/reviews', reviewRouter)
app.use('/api/coins', coinRouter)
app.use('/api/presale', presaleRouter)
app.use('/api/homepage-sections', homepageSectionsRouter)
app.use('/api/newsletter', newsletterRouter)
app.use('/api/size-charts', sizeChartRouter)
app.use('/api/public', publicFaqRouter)
// Alias for public newsletters feed: GET /api/newsletters
app.get('/api/newsletters', newsletterController.listNewsletters)

// ADMIN ROUTE - Register dashboard BEFORE adminAuthRouter to avoid conflicts
app.use('/api/admin', adminDashboardRouter);
app.use('/api/admin', brandAdminRouter);
app.use('/api/admin', brandBankDetailsAdminRouter);
app.use('/api/admin', adminBrandOrdersRouter);
app.use('/api/admin', notificationAdminRouter);
app.use('/api/admin/flash-sales', flashSaleAdminRouter);
app.use('/api/admin/coins', coinsAdminRouter);
app.use('/api/admin/presale-products', presaleProductRouter);
app.use('/api/admin/presale-groups', presaleDetailsRouter);
app.use('/api/admin/presale-bookings', presaleBookingRouter);
app.use('/api/admin', newsletterAdminRouter);
app.use('/api/admin', faqAdminRouter);
app.use('/api/admin', affiliateAdminRouter);
app.use('/api/admin', settlementAdminRouter);
app.use('/api/admin', adminAuthRouter);
// Product groups (homepage grouping) - admin endpoints
app.use('/api/admin/product-groups', productGroupsRouter);
// Custom image sections
const customImageSectionsRouter = require('./router/customImageSectionsRouter');
app.use('/api/admin/custom-image-sections', customImageSectionsRouter);
// Section items (order mapping for homepage sections)
const sectionItemsRouter = require('./router/sectionItemsRouter');
app.use('/api/section-items', sectionItemsRouter);
app.use('/api/admin/section-items', sectionItemsRouter);

// BRAND AUTH ROUTE
app.use('/api/brand', brandAuthRouter)
app.use('/api/brand', orderBrandRouter)
app.use('/api/brand', productBrandRouter)
app.use('/api/brand', brandBankDetailsRouter)
app.use('/api/brand', notificationBrandRouter)
app.use('/api/brand', profileBrandRouter)
app.use('/api/brand', settlementBrandRouter)

app.listen(process.env.PORT, () => {
  console.log('Server Started');
});

