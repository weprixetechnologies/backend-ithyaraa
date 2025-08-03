
const authModel = require('./../model/adminAuthModel')
const authService = require('./authServices')
const authModelNormal = require('./../model/authModel')

const registerAdmininDB = async ({ email, password, name }) => {
    try {
        const hashedPassword = await authService.hashPassword(password);
        const uid = await authService.generateUID();

        const newAdmin = await authModel.createAdmin({
            name,
            email,
            password: hashedPassword,
            uid,
            role: 'admin'
        });

        return newAdmin;
    } catch (err) {
        console.error('Error in registerAdmininDB:', err.message || err);
        throw err;
    }
};
const createTokens = async (payload) => {
    try {
        const accessToken = await authService.generateAccessToken(payload);
        const refreshToken = await authService.generateRefreshToken(payload);

        return { accessToken, refreshToken };
    } catch (err) {
        console.error('Error in createTokens:', err.message || err);
        throw err;
    }
};

const createSessionwithTokenAdmin = async (payload) => {
    const { username, email, refreshToken, phonenumber } = payload
    try {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        const formattedExpiry = expiryDate.toISOString().slice(0, 19).replace('T', ' ');

        const session_function = await authModelNormal.createSession({ username: username, email: email, phonenumber: phonenumber, refreshToken: refreshToken, deviceInfo: 'device', expiry: formattedExpiry });
        return session_function;
    } catch (err) {
        console.error('Error in createSessionwithTokenAdmin:', err.message || err);
        throw err;
    }
};
module.exports = { registerAdmininDB, createTokens, createSessionwithTokenAdmin }