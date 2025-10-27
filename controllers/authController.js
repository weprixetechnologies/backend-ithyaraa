const authService = require('./../services/authServices')

const register = async (req, res) => {
    try {
        const { accessToken, refreshToken } = await authService.register(req.body);

        res.status(201).json({
            message: "User registered successfully",
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ message: error.message || "Server error" });
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(req.body);
        const deviceInfo = req.headers['user-agent'] || 'Unknown device';


        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const { accessToken, refreshToken, user } = await authService.loginUser(email, password, deviceInfo);
        console.log({
            accessToken, refreshToken, user
        });

        res.json({
            message: 'Login successful',
            user,
            accessToken,
            refreshToken
        });
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
};

const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    console.log(req.body);

    console.log('Received refresh token request:', refreshToken ? '[token present]' : '[no token]');

    if (!refreshToken) {
        console.log('Error 6: No refresh token provided in request body');
        return res.status(400).json({ message: 'Refresh token required' });
    }

    try {
        const tokens = await authService.refreshTokens(refreshToken);
        console.log('Token refresh successful, sending new tokens');
        res.json(tokens);
    } catch (err) {
        const msg = err.message || 'Internal server error';
        console.log('Error during token refresh:', msg);

        if (msg === 'NO USER EXIST') {
            console.log('Responding with 404 - user not found');
            return res.status(404).json({ message: msg });
        }
        if (msg === 'PLEASE LOGIN AGAIN' || msg === 'Invalid session refresh token') {
            console.log('Responding with 401 - invalid session or token');
            return res.status(401).json({ message: msg });
        }
        if (msg === 'Invalid or expired refresh token') {
            console.log('Responding with 401 - invalid or expired refresh token');
            return res.status(401).json({ message: msg });
        }

        console.log('Responding with 500 - internal server error');
        res.status(500).json({ message: msg });
    }
};

module.exports = { register, login, refreshToken }