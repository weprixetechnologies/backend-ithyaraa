const addressModel = require('./../model/addressModel');
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs

const generateUniqueAddressID = async () => {
    let isUnique = false;
    let newID;

    while (!isUnique) {
        newID = uuidv4();
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

module.exports = { createAddress, generateUniqueAddressID };
