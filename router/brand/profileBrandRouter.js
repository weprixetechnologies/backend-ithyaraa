const express = require('express');
const profileBrandRouter = express.Router();
const authBrandMiddleware = require('../../middleware/authBrandMiddleware');
const db = require('../../utils/dbconnect');
const brandService = require('../../services/brandService');

// GET /api/brand/profile - Get current brand profile
profileBrandRouter.get('/profile', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const brandID = req.user.uid;

        const [brandRows] = await db.query(
            `SELECT uid, username, name, emailID, gstin, profilePhoto, createdOn, verifiedEmail
             FROM users
             WHERE uid = ? AND role = 'brand'`,
            [brandID]
        );

        if (brandRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Brand not found' });
        }

        const brand = brandRows[0];

        res.json({
            success: true,
            data: {
                uid: brand.uid,
                username: brand.username,
                name: brand.name || '',
                emailID: brand.emailID || '',
                gstin: brand.gstin || '',
                profilePhoto: brand.profilePhoto || null,
                createdOn: brand.createdOn,
                verifiedEmail: brand.verifiedEmail
            }
        });
    } catch (error) {
        console.error('Error fetching brand profile:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message });
    }
});

// PUT /api/brand/profile - Update brand profile
profileBrandRouter.put('/profile', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const brandID = req.user.uid;
        const updateData = req.body;

        // Validate GSTIN if provided
        if (updateData.gstin && updateData.gstin.trim() !== '' && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(updateData.gstin)) {
            return res.status(400).json({ success: false, message: 'Invalid GSTIN format' });
        }

        // Map frontend fields to database fields
        const mappedData = {};
        if (updateData.name !== undefined) mappedData.name = updateData.name || null;
        if (updateData.emailID !== undefined) mappedData.emailID = updateData.emailID || null;
        if (updateData.gstin !== undefined) mappedData.gstin = updateData.gstin && updateData.gstin.trim() !== '' ? updateData.gstin : null;
        if (updateData.profilePhoto !== undefined) mappedData.profilePhoto = updateData.profilePhoto || null;

        // Don't allow updating sensitive fields
        delete mappedData.password;
        delete mappedData.role;
        delete mappedData.uid;
        delete mappedData.username;

        if (Object.keys(mappedData).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        // Check if email is being changed and if it already exists
        if (mappedData.emailID) {
            const [existingEmail] = await db.query(
                `SELECT uid FROM users WHERE emailID = ? AND uid != ? AND role = 'brand'`,
                [mappedData.emailID, brandID]
            );
            if (existingEmail.length > 0) {
                return res.status(409).json({ success: false, message: 'Email already exists' });
            }
        }

        const result = await brandService.updateBrand(brandID, mappedData);

        if (!result.success) {
            return res.status(404).json(result);
        }

        // Fetch updated profile
        const [updatedBrand] = await db.query(
            `SELECT uid, username, name, emailID, gstin, profilePhoto, createdOn, verifiedEmail
             FROM users
             WHERE uid = ? AND role = 'brand'`,
            [brandID]
        );

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                uid: updatedBrand[0].uid,
                username: updatedBrand[0].username,
                name: updatedBrand[0].name || '',
                emailID: updatedBrand[0].emailID || '',
                gstin: updatedBrand[0].gstin || '',
                profilePhoto: updatedBrand[0].profilePhoto || null,
                createdOn: updatedBrand[0].createdOn,
                verifiedEmail: updatedBrand[0].verifiedEmail
            }
        });
    } catch (error) {
        console.error('Error updating brand profile:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
    }
});

module.exports = profileBrandRouter;

