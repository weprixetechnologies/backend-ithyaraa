const auth = require('./../model/authModel')
const authService = require('./../services/authServices')

const createSession = async (req, res) => {
    console.log('Req Started');

    try {
        const sessionData = {
            session_id: 3,
            username: 'Bonnet Singh',
            email: 'bunny@honey.com',
            phonenumber: '7654edfv',
            refreshToken: 'REFRESH_TOKEN1',
            deviceInfo: 'MACINTOSH',
            expiry: '2025-08-31 23:59:59'
        };

        const result = await auth.addSessionDb(sessionData);
        res.status(201).json({ message: 'Session added successfully', insertId: result.insertId });
    } catch (error) {
        console.error('Error in createSession:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

const registerUser = async (req, res) => {
    console.log('Register Route Working');
    console.log(req.body);

    try {
        const { email, password, name, phonenumber, deviceInfo } = req.body;

        // 1. Check if user already exists
        const isExist = await auth.findUserExist(email);
        if (isExist) {
            return res.status(409).json({ message: 'User already exists' });
        }

        // 2. Generate UID & hash password
        const uid = await authService.generateUID();
        const hashedPassword = await authService.hashPassword(password);

        // 3. Create user in database
        const newUser = await auth.createUser({ name, email, password: hashedPassword, uid });

        // 4. Generate tokens
        const payload = { uid, email };
        const accessToken = authService.generateAccessToken(payload);
        const refreshToken = authService.generateRefreshToken(payload);

        // 5. Create session in DB
        const sessionData = {
            session_id: null, // use auto-increment in DB
            username: name,
            email: email,
            phonenumber: phonenumber || 0,
            refreshToken: refreshToken,
            deviceInfo: deviceInfo || req.headers['user-agent'],
            expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        };

        const sessionResult = await auth.addSessionDb(sessionData);

        // 6. Return response
        return res.status(201).json({
            message: 'User registered successfully',
            user: newUser,
            tokens: {
                accessToken,
                refreshToken
            },
            sessionId: sessionResult.insertId
        });

    } catch (error) {
        console.error('Error registering user:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await auth.findUserExist(email);
        if (!user) return res.status(404).json({ message: 'User not found' });
        console.log('✅ User Found:', user);

        const isPasswordValid = await authService.decodePassword(user.password, password);
        if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials' });
        console.log('✅ Password Matched');

        const payload = { uid: user.uid, email: user.emailID };
        console.log(payload);
        const accessToken = authService.generateAccessToken(payload);
        const refreshToken = authService.generateRefreshToken(payload);
        console.log('✅ Tokens Generated:', { accessToken, refreshToken });

        // Set session expiry (30 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        const sessionData = {
            username: user.name,
            email: user.emailID,
            phonenumber: user.phonenumber || '0',
            refreshToken,
            deviceInfo: req.headers['user-agent'],
            expiry: expiryDate.toISOString().slice(0, 19).replace('T', ' ')
        };

        // ✅ Delete existing session if any
        await auth.deleteSessionByEmail(user.emailID);

        // ✅ Create new session
        await auth.createSession(sessionData);
        console.log('✅ Session Replaced');

        res.status(200).json({
            message: 'Login successful',
            accessToken,
            refreshToken
        });
    } catch (err) {
        console.error('❌ Login Error:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const refreshTokenController = async (req, res) => {
    const refreshToken = req.headers['authorization'];

    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token missing' });
    }

    try {
        const { accessToken, newRefreshToken } = await authService.refreshUserSession(refreshToken);

        res.status(200).json({
            message: 'Token refreshed',
            accessToken,
            refreshToken: newRefreshToken
        });

    } catch (err) {
        console.error('❌ Refresh error:', err.message);
        return res.status(403).json({ message: err.message });
    }
};



module.exports = { createSession, registerUser, loginUser, refreshTokenController }