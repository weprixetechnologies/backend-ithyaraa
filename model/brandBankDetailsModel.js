const db = require('../utils/dbconnect');

// Create bank details
const createBankDetails = async (bankData) => {
    await db.query(
        `INSERT INTO brand_bank_details 
        (brandID, accountHolderName, accountNumber, ifscCode, bankName, branchName, panNumber, gstin, address, status, submittedBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
            bankData.brandID, bankData.accountHolderName, bankData.accountNumber,
            bankData.ifscCode, bankData.bankName, bankData.branchName,
            bankData.panNumber, bankData.gstin, bankData.address,
            bankData.status, bankData.submittedBy
        ]
    );
};

// Get bank details by ID
const getBankDetailsByID = async (bankDetailID) => {
    const [rows] = await db.query(
        `SELECT * FROM brand_bank_details WHERE bankDetailID = ?`,
        [bankDetailID]
    );
    return rows[0] || null;
};

// Get all bank details by brandID
const getBankDetailsByBrandID = async (brandID) => {
    const [rows] = await db.query(
        `SELECT * FROM brand_bank_details 
         WHERE brandID = ? 
         ORDER BY 
             CASE status 
                 WHEN 'active' THEN 1 
                 WHEN 'pending' THEN 2 
                 WHEN 'rejected' THEN 3 
             END,
             createdAt DESC`,
        [brandID]
    );
    return rows;
};

// Get active bank details for a brand
const getActiveBankDetails = async (brandID) => {
    const [rows] = await db.query(
        `SELECT * FROM brand_bank_details 
         WHERE brandID = ? AND status = 'active' 
         LIMIT 1`,
        [brandID]
    );
    return rows[0] || null;
};

// Get pending bank details
const getPendingBankDetails = async () => {
    const [rows] = await db.query(
        `SELECT bbd.*, u.name as brandName, u.emailID as brandEmail, u.username
         FROM brand_bank_details bbd
         LEFT JOIN users u ON bbd.brandID = u.uid COLLATE utf8mb4_unicode_ci
         WHERE bbd.status = 'pending'
         ORDER BY bbd.createdAt ASC`
    );
    return rows;
};

// Get all bank details (for admin)
const getAllBankDetails = async () => {
    const [rows] = await db.query(
        `SELECT bbd.*, u.name as brandName, u.emailID as brandEmail, u.username
         FROM brand_bank_details bbd
         LEFT JOIN users u ON bbd.brandID = u.uid COLLATE utf8mb4_unicode_ci
         ORDER BY 
             CASE bbd.status 
                 WHEN 'active' THEN 1 
                 WHEN 'pending' THEN 2 
                 WHEN 'rejected' THEN 3 
             END,
             bbd.createdAt DESC`
    );
    return rows;
};

// Update bank details status
const updateBankDetailsStatus = async (bankDetailID, updateData) => {
    const { status, approvedBy, rejectedBy, rejectionReason } = updateData;

    let query = `UPDATE brand_bank_details SET status = ?`;
    let params = [status];

    if (status === 'active' && approvedBy) {
        query += `, approvedBy = ?, approvedAt = NOW()`;
        params.push(approvedBy);
    }

    if (status === 'rejected') {
        if (rejectedBy) {
            query += `, rejectedBy = ?`;
            params.push(rejectedBy);
        }
        if (rejectionReason) {
            query += `, rejectionReason = ?`;
            params.push(rejectionReason);
        }
        query += `, rejectedAt = NOW()`;
    }

    query += ` WHERE bankDetailID = ?`;
    params.push(bankDetailID);

    await db.query(query, params);
};

// Deactivate all active bank details for a brand (when approving a new one)
const deactivateAllBankDetailsForBrand = async (brandID) => {
    await db.query(
        `UPDATE brand_bank_details 
         SET status = 'rejected', 
         rejectedAt = NOW() 
         WHERE brandID = ? AND status = 'active'`,
        [brandID]
    );
};

// Update bank details
const updateBankDetails = async (bankDetailID, updateData) => {
    const updates = [];
    const values = [];

    Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
            updates.push(`${key} = ?`);
            values.push(updateData[key]);
        }
    });

    if (updates.length === 0) {
        throw new Error('No valid fields to update');
    }

    values.push(bankDetailID);

    await db.query(
        `UPDATE brand_bank_details SET ${updates.join(', ')} WHERE bankDetailID = ?`,
        values
    );
};

// Delete bank details
const deleteBankDetails = async (bankDetailID) => {
    await db.query(`DELETE FROM brand_bank_details WHERE bankDetailID = ?`, [bankDetailID]);
};

module.exports = {
    createBankDetails,
    getBankDetailsByID,
    getBankDetailsByBrandID,
    getActiveBankDetails,
    getPendingBankDetails,
    getAllBankDetails,
    updateBankDetailsStatus,
    deactivateAllBankDetailsForBrand,
    updateBankDetails,
    deleteBankDetails
};

