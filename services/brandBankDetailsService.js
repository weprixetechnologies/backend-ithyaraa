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
    const db = require('../utils/dbconnect');
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // Get bank details with FOR UPDATE lock to prevent race conditions
        const [rows] = await connection.query(
            `SELECT * FROM brand_bank_details WHERE bankDetailID = ? FOR UPDATE`,
            [bankDetailID]
        );
        
        const bankDetails = rows[0];

        if (!bankDetails) {
            await connection.rollback();
            return { success: false, message: 'Bank details not found' };
        }

        if (bankDetails.status !== 'pending') {
            await connection.rollback();
            return { success: false, message: 'Bank details are not in pending status' };
        }

        // Approve the bank details (multiple bank details can be active)
        await connection.query(
            `UPDATE brand_bank_details 
             SET status = 'active', 
             approvedBy = ?, 
             approvedAt = NOW() 
             WHERE bankDetailID = ?`,
            [adminUID, bankDetailID]
        );

        await connection.commit();
        return { success: true, message: 'Bank details approved successfully' };
    } catch (error) {
        await connection.rollback();
        console.error('Approve bank details error:', error);
        return { success: false, message: 'Failed to approve bank details' };
    } finally {
        connection.release();
    }
};

// Reject bank details
const rejectBankDetails = async (bankDetailID, adminUID, rejectionReason) => {
    const db = require('../utils/dbconnect');
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // Get bank details with FOR UPDATE lock to prevent race conditions
        const [rows] = await connection.query(
            `SELECT * FROM brand_bank_details WHERE bankDetailID = ? FOR UPDATE`,
            [bankDetailID]
        );
        
        const bankDetails = rows[0];

        if (!bankDetails) {
            await connection.rollback();
            return { success: false, message: 'Bank details not found' };
        }

        // Only allow rejecting pending bank details to prevent accidental rejection of active ones
        if (bankDetails.status !== 'pending') {
            await connection.rollback();
            return { success: false, message: 'Only pending bank details can be rejected' };
        }

        // Reject the bank details
        await connection.query(
            `UPDATE brand_bank_details 
             SET status = 'rejected', 
             rejectedBy = ?, 
             rejectionReason = ?, 
             rejectedAt = NOW() 
             WHERE bankDetailID = ?`,
            [adminUID, rejectionReason, bankDetailID]
        );

        await connection.commit();
        return { success: true, message: 'Bank details rejected successfully' };
    } catch (error) {
        await connection.rollback();
        console.error('Reject bank details error:', error);
        return { success: false, message: 'Failed to reject bank details' };
    } finally {
        connection.release();
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

