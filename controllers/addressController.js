const addressService = require('../services/addressService');

const postAddress = async (req, res) => {
    console.log(req.body);

    const { uid, emailID } = req.user; // Must be set from authentication middleware
    console.log(req.user);

    try {
        const result = await addressService.createAddress(req.body, uid, emailID);
        res.status(201).json({ message: "Address added successfully", result });
    } catch (err) {
        console.log(err.message);

        res.status(400).json({ error: err.message });
    }
};
const getAddresses = async (req, res) => {
    try {
        const { uid, emailID } = req.user;
        const addresses = await addressService.getAddresses(uid, emailID);
        res.status(200).json({ addresses });
    } catch (err) {

        res.status(400).json({ error: err.message });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const { addressID } = req.params;
        const { uid } = req.user;
        const deleted = await addressService.deleteAddress(addressID, uid);
        if (deleted) {
            res.status(200).json({ message: "Address deleted successfully" });
        } else {
            res.status(404).json({ error: "Address not found" });
        }
    } catch (err) {
        if (err.message.includes("Access denied")) {
            return res.status(403).json({ error: err.message });
        }
        res.status(400).json({ error: err.message });
    }
};
module.exports = { postAddress, getAddresses, deleteAddress };
