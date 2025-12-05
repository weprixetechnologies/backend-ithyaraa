const presaleDetailsModel = require('../model/presaleDetailsModel');
const { randomUUID } = require('crypto');

// Create presale group
const createPresaleGroupController = async (req, res) => {
    try {
        const groupData = req.body;

        // Generate presaleGroupID if not provided
        if (!groupData.presaleGroupID) {
            groupData.presaleGroupID = `PRESALE_GROUP_${randomUUID().substring(0, 8).toUpperCase()}`;
        }

        const result = await presaleDetailsModel.createPresaleGroup(groupData);

        // Add products to group if provided
        if (groupData.productIDs && groupData.productIDs.length > 0) {
            await presaleDetailsModel.addProductsToGroup(groupData.presaleGroupID, groupData.productIDs);
        }

        res.status(201).json({
            success: true,
            message: result.message,
            data: { presaleGroupID: groupData.presaleGroupID }
        });
    } catch (error) {
        console.error('Error creating presale group:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create presale group',
            error: error.message
        });
    }
};

// Get all presale groups
const getAllPresaleGroupsController = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            showOnHomepage: req.query.showOnHomepage !== undefined ? req.query.showOnHomepage === 'true' : undefined
        };

        const groups = await presaleDetailsModel.getAllPresaleGroups(filters);

        res.status(200).json({
            success: true,
            data: groups
        });
    } catch (error) {
        console.error('Error fetching presale groups:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch presale groups',
            error: error.message
        });
    }
};

// Get presale group by ID
const getPresaleGroupByIDController = async (req, res) => {
    try {
        const { presaleGroupID } = req.params;
        const group = await presaleDetailsModel.getPresaleGroupByID(presaleGroupID);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Presale group not found'
            });
        }

        res.status(200).json({
            success: true,
            data: group
        });
    } catch (error) {
        console.error('Error fetching presale group:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch presale group',
            error: error.message
        });
    }
};

// Update presale group
const updatePresaleGroupController = async (req, res) => {
    try {
        const { presaleGroupID } = req.params;
        const updateData = req.body;

        // Handle product updates separately
        const { productIDs, ...groupUpdateData } = updateData;

        const result = await presaleDetailsModel.updatePresaleGroup(presaleGroupID, groupUpdateData);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message
            });
        }

        // Update products if provided
        if (productIDs !== undefined) {
            await presaleDetailsModel.addProductsToGroup(presaleGroupID, productIDs);
        }

        res.status(200).json({
            success: true,
            message: 'Presale group updated successfully'
        });
    } catch (error) {
        console.error('Error updating presale group:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update presale group',
            error: error.message
        });
    }
};

// Delete presale group
const deletePresaleGroupController = async (req, res) => {
    try {
        const { presaleGroupID } = req.params;
        const result = await presaleDetailsModel.deletePresaleGroup(presaleGroupID);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message
            });
        }

        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Error deleting presale group:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete presale group',
            error: error.message
        });
    }
};

module.exports = {
    createPresaleGroupController,
    getAllPresaleGroupsController,
    getPresaleGroupByIDController,
    updatePresaleGroupController,
    deletePresaleGroupController
};

