const db = require('../utils/dbconnect');

/**
 * Insert a new brand application
 * @param {Object} data
 * @returns {Object} Inserted row id
 */
const createApplication = async (data) => {
    const {
        ref_id,
        brand_name,
        website,
        product_type,
        address,
        interests,
        partnership_type,
        dropship_status,
        monthly_order_volume,
        goals,
        lookbook_name,
        lookbook_url,
        contact_name,
        contact_position,
        contact_email,
        contact_phone,
        consent,
    } = data;

    const [result] = await db.query(
        `INSERT INTO brand_applications
        (ref_id, brand_name, website, product_type, address, interests, partnership_type,
         dropship_status, monthly_order_volume, goals, lookbook_name, lookbook_url,
         contact_name, contact_position, contact_email, contact_phone, consent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            ref_id,
            brand_name,
            website,
            product_type || 'fashion',
            address,
            JSON.stringify(interests || []),
            partnership_type ? JSON.stringify(partnership_type) : null,
            dropship_status || 'no',
            monthly_order_volume || null,
            goals || null,
            lookbook_name || null,
            lookbook_url || null,
            contact_name,
            contact_position || null,
            contact_email,
            contact_phone,
            consent ? 1 : 0,
        ]
    );

    return result.insertId;
};

/**
 * Fetch all applications, optionally filtered by status
 * @param {string|null} status - 'pending' | 'approved' | 'rejected' | null for all
 */
const getAllApplications = async (status = null) => {
    let query = `SELECT id, ref_id, brand_name, website, product_type, interests, partnership_type,
                        contact_name, contact_position, contact_email, contact_phone, status,
                        brand_uid, submitted_at, reviewed_at, reviewed_by, notes
                 FROM brand_applications`;
    const params = [];

    if (status) {
        query += ` WHERE status = ?`;
        params.push(status);
    }

    query += ` ORDER BY submitted_at DESC`;

    const [rows] = await db.query(query, params);
    return rows;
};

/**
 * Fetch a single application by id
 */
const getApplicationById = async (id) => {
    const [rows] = await db.query(
        `SELECT * FROM brand_applications WHERE id = ? LIMIT 1`,
        [id]
    );
    return rows[0] || null;
};

/**
 * Check if ref_id already exists
 */
const getApplicationByRefId = async (refId) => {
    const [rows] = await db.query(
        `SELECT id FROM brand_applications WHERE ref_id = ? LIMIT 1`,
        [refId]
    );
    return rows[0] || null;
};

/**
 * Update application status after admin review
 */
const updateApplicationStatus = async (id, status, reviewedBy, brandUid = null, notes = null) => {
    const [result] = await db.query(
        `UPDATE brand_applications
         SET status = ?, reviewed_at = NOW(), reviewed_by = ?, brand_uid = ?, notes = ?
         WHERE id = ?`,
        [status, reviewedBy, brandUid, notes, id]
    );
    return result.affectedRows > 0;
};

module.exports = {
    createApplication,
    getAllApplications,
    getApplicationById,
    getApplicationByRefId,
    updateApplicationStatus,
};
