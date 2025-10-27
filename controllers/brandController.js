const brandService = require('../services/brandService');
const { generateUID } = require('../utils/uidUtils');
const argon2 = require('argon2');
const { addSendEmailJob } = require('../queue/emailProducer');

// Get all brands
const getAllBrands = async (req, res) => {
    try {
        const result = await brandService.getAllBrands();
        return res.status(200).json(result);
    } catch (error) {
        console.error('Get all brands error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch brands' });
    }
};

// Get brand by UID
const getBrandByUID = async (req, res) => {
    try {
        const { uid } = req.params;
        const result = await brandService.getBrandByUID(uid);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Get brand by UID error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch brand' });
    }
};

// Create brand (for superadmin)
const createBrand = async (req, res) => {
    try {
        const { name, email, password, gstin, profilePhoto } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const result = await brandService.createBrandUser({
            email,
            name,
            password,
            gstin,
            profilePhoto: profilePhoto || null,
            deviceInfo: req.headers['user-agent'] || 'unknown'
        });

        if (!result.success) {
            return res.status(409).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error('Create brand error:', error);

        // Handle specific database errors
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.sqlMessage.includes('username')) {
                return res.status(409).json({ success: false, message: 'Username already exists' });
            } else if (error.sqlMessage.includes('emailID')) {
                return res.status(409).json({ success: false, message: 'Email already exists' });
            } else if (error.sqlMessage.includes('uid')) {
                return res.status(409).json({ success: false, message: 'User ID already exists' });
            }
        }

        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update brand
const updateBrand = async (req, res) => {
    try {
        const { uid } = req.params;
        const updateData = req.body;

        // Validate GSTIN if provided
        if (updateData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(updateData.gstin)) {
            return res.status(400).json({ success: false, message: 'Invalid GSTIN format' });
        }

        // Map frontend fields to database fields
        const mappedData = {};
        if (updateData.name !== undefined) mappedData.name = updateData.name;
        if (updateData.email !== undefined) mappedData.emailID = updateData.email;
        if (updateData.gstin !== undefined) mappedData.gstin = updateData.gstin || null;
        if (updateData.profilePhoto !== undefined) mappedData.profilePhoto = updateData.profilePhoto;

        // Don't allow updating sensitive fields
        delete mappedData.password;
        delete mappedData.role;
        delete mappedData.uid;

        const result = await brandService.updateBrand(uid, mappedData);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Update brand error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update brand' });
    }
};

// Reset brand password
const resetBrandPassword = async (req, res) => {
    try {
        const { uid } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ success: false, message: 'New password is required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const result = await brandService.resetBrandPassword(uid, newPassword);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Reset brand password error:', error);
        return res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
};

// Get brand review statistics
const getBrandReviewStats = async (req, res) => {
    try {
        const { brandID } = req.params;
        const result = await brandService.getBrandReviewStats(brandID);

        return res.status(200).json(result);
    } catch (error) {
        console.error('Get brand review stats error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch brand review stats' });
    }
};

// Delete brand
const deleteBrand = async (req, res) => {
    try {
        const { uid } = req.params;
        const result = await brandService.deleteBrand(uid);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Delete brand error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete brand' });
    }
};

module.exports = {
    getAllBrands,
    getBrandByUID,
    createBrand,
    updateBrand,
    resetBrandPassword,
    getBrandReviewStats,
    deleteBrand
};

