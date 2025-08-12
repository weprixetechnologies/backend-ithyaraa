const adminAuthService = require('../services/adminAuthServices')
const modelNormal = require('../model/authModel')

const adminAuthRegister = async (req, res) => {
    try {
        const { email, password, name, phonenumber } = req.body;
        console.log(email, password, name);

        // 1. Register Admin in DB
        const newAdmin = await adminAuthService.registerAdmininDB({ email, password, name });
        console.log('newadmin', newAdmin);

        if (!newAdmin) throw new Error('Admin creation failed');

        // 2. Generate Tokens
        const { accessToken, refreshToken } = await adminAuthService.createTokens({ uid: newAdmin.uid, role: newAdmin.role });
        if (!accessToken || !refreshToken) throw new Error('Token generation failed');
        console.log('name', name);

        const session_function = await adminAuthService.createSessionwithTokenAdmin({ name: name, phonenumber: phonenumber, email: email, refreshToken: refreshToken });
        console.log(session_function);

        if (!session_function) throw new Error('Session creation failed');

        // 4. Success response
        return res.status(201).json({
            message: 'Admin registered successfully',
            data: newAdmin,
            tokens: {
                accessToken,
                refreshToken
            }
        });

    } catch (err) {
        console.error('Admin registration failed:', err.message || err);
        return res.status(500).json({ error: 'Internal server error', reason: err.message });
    }
}


module.exports = { adminAuthRegister }