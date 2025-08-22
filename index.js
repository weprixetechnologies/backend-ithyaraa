//EXTERNAL
require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors')

//Core Modules
const userRouter = require('./router/usersRouter')
const authRouter = require('./router/authRouter')
const adminAuthRouter = require('./router/admin/authAdminRouter')
const productRouter = require('./router/admin/productRouter')
const offerRouter = require('./router/admin/offerAdminRouter')
const categoryRouter = require('./router/admin/categoryRouter')
const commonRouter = require('./router/commonRouter')
const couponsRouter = require('./router/admin/couponsRouter')
const makeComboRouter = require('./router/admin/makeComboRouter')
const comboRouter = require('./router/admin/comboRouter')
const addressRouter = require('./router/addressRouter')
const giftcardRouter = require('./router/giftcardRouter')
const affiliateRouter = require('./router/affiliateRouter')

// CORS setup (replace with your actual frontend domain)
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }));

app.use('/api/', commonRouter)
app.use('/api/user', userRouter); //user apis
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


// ADMIN ROUTE
app.use('/api/admin', adminAuthRouter);

app.listen(process.env.PORT, () => {
    console.log('Server Started');
});
