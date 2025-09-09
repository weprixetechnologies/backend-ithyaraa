const cartService = require('../services/cartService');

async function addCartItem(req, res) {
    try {
        const { uid } = req.user; // assuming auth middleware sets req.user
        const { productID, quantity, variationID, variationName, referBy } = req.body;

        console.log('Cart Controller - Received data:', {
            uid,
            productID,
            quantity,
            variationID,
            variationName,
            referBy
        });

        if (!uid || !productID || (typeof quantity === 'undefined')) {
            return res.status(400).json({ message: 'uid, productID, and quantity are required' });
        }

        const result = await cartService.addToCart(uid, productID, Number(quantity), variationID, variationName, referBy);
        res.status(200).json({ success: true, cartItem: result.cartItem, cartDetail: result.cartDetail });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
}
async function getCart(req, res) {

    try {
        const { uid } = req.user;
        const data = await cartService.getCart(uid);
        res.json({ success: true, ...data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

const removeFromCart = async (req, res) => {
    const { productID } = req.body;
    const { uid } = req.user;

    const result = await cartService.removeCartItem(uid, productID);
    return res.status(result.success ? 200 : 400).json(result);
};

async function addCartCombo(req, res) {
    try {
        const { uid } = req.user; // assuming auth middleware sets req.user
        const { quantity, mainProductID, products } = req.body;
        console.log(req.body);

        if (!mainProductID || !Array.isArray(products)) {
            return res.status(400).json({ success: false, message: 'Invalid payload' });
        }

        const result = await cartService.addCartCombo(uid, quantity, mainProductID, products);
        return res.status(200).json({ success: true, ...result });
    } catch (err) {
        console.error('Error in addCartCombo:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}



module.exports = { addCartItem, getCart, removeFromCart, addCartCombo };
