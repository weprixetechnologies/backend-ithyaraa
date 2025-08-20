const addressService = require('../services/addressService');

const postAddress = async (req, res) => {
    const { uid, emailID } = req.user; // Must be set from authentication middleware
    try {
        const result = await addressService.createAddress(req.body, uid, emailID);
        res.status(201).json({ message: "Address added successfully", result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { postAddress };
