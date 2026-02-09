const affiliateService = require('../services/affiliateService');

// GET /admin/affiliates - List affiliate users with filters
const listAffiliates = async (req, res) => {
    try {
        const { search = '', status = '', page = 1, limit = 10 } = req.query;
        const result = await affiliateService.getAffiliateListService({
            search: search || undefined,
            status: status || undefined,
            page: parseInt(page, 10),
            limit: parseInt(limit, 10)
        });
        const totalPages = Math.ceil((result.total || 0) / result.limit);
        return res.status(200).json({
            success: true,
            data: result.data,
            pagination: {
                currentPage: result.page,
                totalPages,
                totalAffiliates: result.total,
                hasNext: result.page < totalPages,
                hasPrev: result.page > 1
            }
        });
    } catch (error) {
        console.error('listAffiliates error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// GET /admin/affiliates/:uid - Get single affiliate full detail (user, analytics, orders, transactions, payout history)
const getAffiliateByUid = async (req, res) => {
    try {
        const { uid } = req.params;
        if (!uid) {
            return res.status(400).json({ success: false, error: 'uid is required' });
        }
        const detail = await affiliateService.getAffiliateDetailForAdminService(uid);
        if (!detail.user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.status(200).json({ success: true, data: detail });
    } catch (error) {
        console.error('getAffiliateByUid error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// PUT /admin/affiliates/:uid/approve - Approve affiliate (admin only)
const approveAffiliate = async (req, res) => {
    try {
        const { uid } = req.params;
        if (!uid) {
            return res.status(400).json({ success: false, error: 'uid is required' });
        }
        const result = await affiliateService.adminApproveAffiliateService(uid);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'User not found or already approved' });
        }
        return res.status(200).json({
            success: true,
            message: 'Affiliate approved successfully'
        });
    } catch (error) {
        console.error('approveAffiliate error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// PUT /admin/affiliates/:uid/reject - Reject affiliate (admin only)
const rejectAffiliate = async (req, res) => {
    try {
        const { uid } = req.params;
        if (!uid) {
            return res.status(400).json({ success: false, error: 'uid is required' });
        }
        const result = await affiliateService.adminRejectAffiliateService(uid);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.status(200).json({
            success: true,
            message: 'Affiliate request rejected'
        });
    } catch (error) {
        console.error('rejectAffiliate error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// PUT /admin/affiliates/transactions/:txnID/status - Update transaction status (admin only)
const updateTransactionStatus = async (req, res) => {
    try {
        const { txnID } = req.params;
        const { status } = req.body;
        if (!txnID || !status) {
            return res.status(400).json({ success: false, error: 'txnID and status are required' });
        }
        await affiliateService.updateAffiliateTransactionStatusService(txnID, status);
        return res.status(200).json({ success: true, message: 'Status updated', data: { txnID, status } });
    } catch (error) {
        if (error.message && error.message.startsWith('Invalid status')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        console.error('updateTransactionStatus error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// POST /admin/affiliates/transactions/manual - Create manual transaction (admin only)
const createManualTransaction = async (req, res) => {
    try {
        const { uid, amount, type, comment } = req.body;
        if (!uid || amount == null) {
            return res.status(400).json({ success: false, error: 'uid and amount are required' });
        }
        const data = await affiliateService.createManualAffiliateTransactionService({
            uid,
            amount: Number(amount),
            type: type || 'incoming',
            comment
        });
        return res.status(201).json({ success: true, message: 'Transaction created', data });
    } catch (error) {
        if (error.message && (error.message.includes('required') || error.message.includes('Insufficient') || error.message.includes('User not found'))) {
            return res.status(400).json({ success: false, error: error.message });
        }
        console.error('createManualTransaction error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// GET /admin/affiliates/transactions/statuses - List allowed statuses for dropdown (admin only)
const getTransactionStatuses = async (req, res) => {
    try {
        const statuses = affiliateService.getAffiliateTransactionStatusesService();
        return res.status(200).json({ success: true, data: statuses });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

module.exports = {
    listAffiliates,
    getAffiliateByUid,
    approveAffiliate,
    rejectAffiliate,
    updateTransactionStatus,
    createManualTransaction,
    getTransactionStatuses
};
