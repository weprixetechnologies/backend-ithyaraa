const newsletterService = require('../services/newsletterService');

const subscribe = async (req, res) => {
    try {
        const { name, email, emailID } = req.body;
        // Prefer explicit email, but support emailID commonly used in the app
        const resolvedEmail = email || emailID;
        const result = await newsletterService.subscribe({ name, email: resolvedEmail });
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        const status = error.statusCode || 400;
        res.status(status).json({
            success: false,
            message: error.message
        });
    }
};

const getStatus = async (req, res) => {
    try {
        const email = req.query.email || req.body?.email;
        const result = await newsletterService.getSubscriptionStatus({ email });
        // Return a flat shape for frontend:
        // { subscribed: boolean, email?: string, status?, name? }
        res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 400;
        res.status(status).json({
            success: false,
            message: error.message
        });
    }
};

const listNewsletters = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const result = await newsletterService.listPublicNewsletters({ page, limit });
        res.status(200).json({
            success: true,
            data: result.data,
            total: result.total
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const unsubscribe = async (req, res) => {
    try {
        const token = req.body.token || req.query.token;
        const email = req.body.email || req.body.emailID || req.query.email || req.query.emailID;

        // 1) Email or emailID explicitly provided (in-app unsubscribe button)
        if (email) {
            const result = await newsletterService.unsubscribeByEmail({ email });
            return res.status(200).json({
                success: true,
                data: result
            });
        }

        // 2) Token-based unsubscribe (email link flow)
        if (token) {
            const result = await newsletterService.unsubscribe({ token });
            return res.status(200).json({
                success: true,
                data: result
            });
        }

        // 3) No email or token – cannot proceed
        return res.status(400).json({
            success: false,
            message: 'Either token or email/emailID is required'
        });
    } catch (error) {
        const status = error.statusCode || 400;
        res.status(status).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    subscribe,
    getStatus,
    listNewsletters,
    unsubscribe
};

