const brandBankDetailsService = require('../services/brandBankDetailsService');

// Add bank details (by brand or admin)
const addBankDetails = async (req, res) => {
    try {
        const {
            brandID, accountHolderName, accountNumber, ifscCode,
            bankName, branchName, panNumber, gstin, address
        } = req.body;

        if (!brandID || !accountHolderName || !accountNumber || !ifscCode || !bankName) {
            return res.status(400).json({ success: false, message: 'Required fields are missing' });
        }

        // Determine if submitted by admin or brand
        const submittedBy = req.user.role === 'admin' ? req.user.uid : req.user.uid;
        const status = req.user.role === 'admin' ? 'active' : 'pending';

        const bankData = {
            brandID: req.user.role === 'brand' ? req.user.uid : brandID,
            accountHolderName,
            accountNumber,
            ifscCode,
            bankName,
            branchName: branchName || null,
            panNumber: panNumber || null,
            gstin: gstin || null,
            address: address || null,
            status,
            submittedBy
        };

        const result = await brandBankDetailsService.addBankDetails(bankData);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error('Add bank details error:', error);
        return res.status(500).json({ success: false, message: 'Failed to add bank details' });
    }
};

// Get bank details by ID
const getBankDetailsByID = async (req, res) => {
    try {
        const { bankDetailID } = req.params;
        const result = await brandBankDetailsService.getBankDetailsByID(bankDetailID);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Get bank details error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch bank details' });
    }
};

// Get bank details by brand ID
const getBankDetailsByBrandID = async (req, res) => {
    try {
        const brandID = req.params.bankDetailID && req.params.bankDetailID !== 'brand' ? req.params.bankDetailID : req.params.brandID;
        const result = await brandBankDetailsService.getBankDetailsByBrandID(brandID);

        return res.status(200).json(result);
    } catch (error) {
        console.error('Get bank details by brand error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch bank details' });
    }
};

// Get active bank details
const getActiveBankDetails = async (req, res) => {
    try {
        const { brandID } = req.params;
        const result = await brandBankDetailsService.getActiveBankDetails(brandID);

        return res.status(200).json(result);
    } catch (error) {
        console.error('Get active bank details error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch active bank details' });
    }
};

// Get pending bank details (admin only)
const getPendingBankDetails = async (req, res) => {
    try {
        const result = await brandBankDetailsService.getPendingBankDetails();
        return res.status(200).json(result);
    } catch (error) {
        console.error('Get pending bank details error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch pending bank details' });
    }
};

// Get all bank details (admin only)
const getAllBankDetails = async (req, res) => {
    try {
        const result = await brandBankDetailsService.getAllBankDetails();
        return res.status(200).json(result);
    } catch (error) {
        console.error('Get all bank details error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch bank details' });
    }
};

// Approve bank details (admin only)
const approveBankDetails = async (req, res) => {
    try {
        const { bankDetailID } = req.params;
        const adminUID = req.user.uid;

        const result = await brandBankDetailsService.approveBankDetails(bankDetailID, adminUID);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Approve bank details error:', error);
        return res.status(500).json({ success: false, message: 'Failed to approve bank details' });
    }
};

// Reject bank details (admin only)
const rejectBankDetails = async (req, res) => {
    try {
        const { bankDetailID } = req.params;
        const { rejectionReason } = req.body;
        const adminUID = req.user.uid;

        const result = await brandBankDetailsService.rejectBankDetails(bankDetailID, adminUID, rejectionReason);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Reject bank details error:', error);
        return res.status(500).json({ success: false, message: 'Failed to reject bank details' });
    }
};

// Update bank details
const updateBankDetails = async (req, res) => {
    try {
        const { bankDetailID } = req.params;
        const updateData = req.body;

        const result = await brandBankDetailsService.updateBankDetails(bankDetailID, updateData);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Update bank details error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update bank details' });
    }
};

// Delete bank details
const deleteBankDetails = async (req, res) => {
    try {
        const { bankDetailID } = req.params;
        const result = await brandBankDetailsService.deleteBankDetails(bankDetailID);

        return res.status(200).json(result);
    } catch (error) {
        console.error('Delete bank details error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete bank details' });
    }
};

module.exports = {
    addBankDetails,
    getBankDetailsByID,
    getBankDetailsByBrandID,
    getActiveBankDetails,
    getPendingBankDetails,
    getAllBankDetails,
    approveBankDetails,
    rejectBankDetails,
    updateBankDetails,
    deleteBankDetails
};

