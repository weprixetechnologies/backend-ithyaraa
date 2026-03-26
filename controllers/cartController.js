const cartService = require('../services/cartService');

async function addCartItem(req, res) {
    try {
        console.log('🔍 Cart Controller - Request received');
        console.log('🔍 req.user:', req.user);
        console.log('🔍 req.body:', req.body);

        const { uid } = req.user; // JWT payload uses uid
        const { productID, quantity, variationID, variationName, referBy, customInputs, selectedDressType } = req.body;

        console.log('Cart Controller - Received data:', {
            uid,
            productID,
            quantity,
            variationID,
            variationName,
            referBy,
            customInputs,
            selectedDressType
        });

        if (!uid || !productID || (typeof quantity === 'undefined')) {
            return res.status(400).json({ message: 'uid, productID, and quantity are required' });
        }

        const result = await cartService.addToCart(uid, productID, Number(quantity), variationID, variationName, referBy, customInputs, selectedDressType);
        res.status(200).json({ 
            success: true, 
            cartItem: result.cartItem, 
            cartDetail: result.cartDetail,
            crossSellProducts: result.crossSellProducts || []
        });

    } catch (error) {
        console.error('❌ Cart Controller Error:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({ success: false, message: error.message });
    }
}
async function getCart(req, res) {
    console.log('🔍 getCart called');
    console.log('req.user:', req.user);

    try {
        const { uid } = req.user; // JWT payload uses uid
        console.log('Extracted uid:', uid);

        if (!uid) {
            console.error('❌ UID is null or undefined in getCart');
            return res.status(400).json({
                success: false,
                message: 'User ID is missing from token',
                debug: { reqUser: req.user }
            });
        }

        const data = await cartService.getCart(uid);
        res.json({ success: true, ...data });
    } catch (err) {
        console.error('❌ Error in getCart:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

const removeFromCart = async (req, res) => {
    try {
        const { cartItemID } = req.body;
        const { uid } = req.user; // JWT payload uses uid

        if (!cartItemID) {
            return res.status(400).json({ success: false, message: 'Cart item ID is required' });
        }

        const result = await cartService.removeCartItem(uid, cartItemID);
        return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error removing cart item:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

async function addCartCombo(req, res) {
    console.log(res.body);

    try {
        const { uid } = req.user; // JWT payload uses uid
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

async function updateCartItemsSelected(req, res) {
    try {
        const { uid } = req.user;
        const { selectedItems } = req.body; // Array of cartItemIDs

        if (!Array.isArray(selectedItems)) {
            return res.status(400).json({ success: false, message: 'selectedItems must be an array' });
        }

        const result = await cartService.updateCartItemsSelected(uid, selectedItems);
        
        if (result.success) {
            // Recalculate cart totals after updating selection
            const cart = await cartService.getCart(uid);
            return res.status(200).json({ 
                success: true, 
                message: 'Cart items selection updated',
                cart: cart
            });
        } else {
            return res.status(500).json({ success: false, message: result.error || 'Failed to update selection' });
        }
    } catch (error) {
        console.error('Error updating cart items selection:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = { addCartItem, getCart, removeFromCart, addCartCombo, updateCartItemsSelected };
