const brandBankDetailsModel = require('../model/brandBankDetailsModel');

// Add bank details
const addBankDetails = async (bankData) => {
    try {
        await brandBankDetailsModel.createBankDetails(bankData);
        return { success: true, message: 'Bank details added successfully' };
    } catch (error) {
        console.error('Add bank details error:', error);
        return { success: false, message: 'Failed to add bank details' };
    }
};

// Get bank details by ID
const getBankDetailsByID = async (bankDetailID) => {
    try {
        const bankDetails = await brandBankDetailsModel.getBankDetailsByID(bankDetailID);
        if (!bankDetails) {
            return { success: false, message: 'Bank details not found' };
        }
        return { success: true, data: bankDetails };
    } catch (error) {
        console.error('Get bank details error:', error);
        return { success: false, message: 'Failed to fetch bank details' };
    }
};

// Get bank details by brand ID
const getBankDetailsByBrandID = async (brandID) => {
    try {
        const bankDetails = await brandBankDetailsModel.getBankDetailsByBrandID(brandID);
        return { success: true, data: bankDetails };
    } catch (error) {
        console.error('Get bank details by brand error:', error);
        return { success: false, message: 'Failed to fetch bank details' };
    }
};

// Get active bank details
const getActiveBankDetails = async (brandID) => {
    try {
        const bankDetails = await brandBankDetailsModel.getActiveBankDetails(brandID);
        if (!bankDetails) {
            return { success: false, message: 'No active bank details found' };
        }
        return { success: true, data: bankDetails };
    } catch (error) {
        console.error('Get active bank details error:', error);
        return { success: false, message: 'Failed to fetch active bank details' };
    }
};

// Get pending bank details
const getPendingBankDetails = async () => {
    try {
        const bankDetails = await brandBankDetailsModel.getPendingBankDetails();
        return { success: true, data: bankDetails };
    } catch (error) {
        console.error('Get pending bank details error:', error);
        return { success: false, message: 'Failed to fetch pending bank details' };
    }
};

// Get all bank details
const getAllBankDetails = async () => {
    try {
        const bankDetails = await brandBankDetailsModel.getAllBankDetails();
        return { success: true, data: bankDetails };
    } catch (error) {
        console.error('Get all bank details error:', error);
        return { success: false, message: 'Failed to fetch bank details' };
    }
};

// Approve bank details
const approveBankDetails = async (bankDetailID, adminUID) => {
    try {
        const bankDetails = await brandBankDetailsModel.getBankDetailsByID(bankDetailID);

        if (!bankDetails) {
            return { success: false, message: 'Bank details not found' };
        }

        if (bankDetails.status !== 'pending') {
            return { success: false, message: 'Bank details are not in pending status' };
        }

        // Deactivate all other active bank details for this brand
        await brandBankDetailsModel.deactivateAllBankDetailsForBrand(bankDetails.brandID);

        // Approve the bank details
        await brandBankDetailsModel.updateBankDetailsStatus(bankDetailID, {
            status: 'active',
            approvedBy: adminUID
        });

        return { success: true, message: 'Bank details approved successfully' };
    } catch (error) {
        console.error('Approve bank details error:', error);
        return { success: false, message: 'Failed to approve bank details' };
    }
};

// Reject bank details
const rejectBankDetails = async (bankDetailID, adminUID, rejectionReason) => {
    try {
        const bankDetails = await brandBankDetailsModel.getBankDetailsByID(bankDetailID);

        if (!bankDetails) {
            return { success: false, message: 'Bank details not found' };
        }

        await brandBankDetailsModel.updateBankDetailsStatus(bankDetailID, {
            status: 'rejected',
            rejectedBy: adminUID,
            rejectionReason
        });

        return { success: true, message: 'Bank details rejected successfully' };
    } catch (error) {
        console.error('Reject bank details error:', error);
        return { success: false, message: 'Failed to reject bank details' };
    }
};

// Update bank details
const updateBankDetails = async (bankDetailID, updateData) => {
    try {
        await brandBankDetailsModel.updateBankDetails(bankDetailID, updateData);
        return { success: true, message: 'Bank details updated successfully' };
    } catch (error) {
        console.error('Update bank details error:', error);
        return { success: false, message: 'Failed to update bank details' };
    }
};

// Delete bank details
const deleteBankDetails = async (bankDetailID) => {
    try {
        await brandBankDetailsModel.deleteBankDetails(bankDetailID);
        return { success: true, message: 'Bank details deleted successfully' };
    } catch (error) {
        console.error('Delete bank details error:', error);
        return { success: false, message: 'Failed to delete bank details' };
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

