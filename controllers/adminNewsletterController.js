const newsletterService = require('../services/newsletterService');

const listSubscribers = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 50, export: exportFormat } = req.query;
        const result = await newsletterService.adminListSubscribers({ status, search, page, limit });

        if (exportFormat === 'csv') {
            const rows = result.data || [];
            const headers = ['id', 'name', 'email', 'status', 'subscribed_at', 'unsubscribed_at', 'last_email_sent_at', 'created_at', 'updated_at'];
            const csvRows = [
                headers.join(','),
                ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))
            ];
            const csv = csvRows.join('\n');

            res.header('Content-Type', 'text/csv');
            res.header('Content-Disposition', 'attachment; filename="newsletter_subscribers.csv"');
            return res.send(csv);
        }

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

const listNewsletters = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const result = await newsletterService.adminListNewsletters({ page, limit });
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

const createNewsletter = async (req, res) => {
    try {
        const { title, content_html, content_text, status, scheduled_at } = req.body;
        const created_by = req.user?.uid || req.user?.id || null;
        const newsletter = await newsletterService.adminCreateNewsletter({
            title,
            content_html,
            content_text,
            status,
            scheduled_at,
            created_by
        });
        res.status(201).json({
            success: true,
            data: newsletter
        });
    } catch (error) {
        const statusCode = error.statusCode || 400;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

const sendNewsletter = async (req, res) => {
    try {
        const { id } = req.params;
        const retryFailedOnly = req.query.retryFailed === 'true';
        const result = await newsletterService.adminSendNewsletter({
            newsletterId: Number(id),
            retryFailedOnly
        });

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        const statusCode = error.statusCode || 400;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

const getNewsletterStats = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await newsletterService.adminGetNewsletterStats({ newsletterId: Number(id) });
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        const statusCode = error.statusCode || 400;
        res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    listSubscribers,
    listNewsletters,
    createNewsletter,
    sendNewsletter,
    getNewsletterStats
};

