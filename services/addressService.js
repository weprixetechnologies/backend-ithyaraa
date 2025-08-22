const addressModel = require('./../model/addressModel');

const generateRandomID = (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
    }
    return result;
};

const generateUniqueAddressID = async () => {
    let isUnique = false;
    let newID;

    while (!isUnique) {
        newID = generateRandomID(10); // 10-char alphanumeric
        const exists = await addressModel.checkAddressIDExists(newID);
        if (!exists) isUnique = true;
    }

    return newID;
};

const createAddress = async (data, uid, emailID) => {
    // Check if user exists
    const userExists = await addressModel.checkUserExists(uid);
    if (!userExists) throw new Error("User does not exist");

    // Generate addressID if not provided
    if (!data.addressID) {
        data.addressID = await generateUniqueAddressID();
    } else {
        const exists = await addressModel.checkAddressIDExists(data.addressID);
        if (exists) throw new Error("addressID already exists");
    }

    // Attach uid and emailID from logged-in user
    data.uid = uid;
    data.emailID = emailID;

    return await addressModel.addAddress(data);
};

const getAddresses = async (uid, emailID) => {
    if (!uid && !emailID) {
        throw new Error("Either uid or emailID must be provided");
    }
    return await addressModel.getAddresses(uid, emailID);
};

const deleteAddress = async (addressID) => {
    if (!addressID) {
        throw new Error("addressID is required");
    }

    const exists = await addressModel.checkAddressIDExists(addressID);
    if (!exists) {
        throw new Error("Address not found");
    }

    const deleted = await addressModel.deleteAddress(addressID);
    return deleted;
};
module.exports = { createAddress, generateUniqueAddressID, getAddresses, deleteAddress };
