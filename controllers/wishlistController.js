const wishlistService = require('../services/wishlistService');

const addWishlist = async (req, res) => {
    try {
        const { uid } = req.user; // from auth middleware
        const { productID } = req.body;

        if (!productID) {
            return res.status(400).json({ message: 'productID is required' });
        }

        const wishlistItem = await wishlistService.addWishlist(uid, productID);
        res.status(201).json({
            message: 'Product added to wishlist',
            data: wishlistItem
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};
const removeWishlist = async (req, res) => {
    try {
        const { uid } = req.user; // from auth middleware
        const { productID } = req.body; // or req.params if you prefer URL

        if (!productID) {
            return res.status(400).json({ message: 'productID is required' });
        }

        await wishlistService.removeWishlist(uid, productID);

        res.status(200).json({
            message: 'Product removed from wishlist',
            productID
        });
    } catch (error) {
        console.error(error);
        res.status(404).json({ message: error.message });
    }
};

const getWishlist = async (req, res) => {
    try {
        const { uid } = req.user; // from auth middleware

        const wishlistItems = await wishlistService.getWishlist(uid);

        res.status(200).json({
            message: 'Wishlist fetched successfully',
            data: wishlistItems
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    addWishlist, removeWishlist, getWishlist
};
