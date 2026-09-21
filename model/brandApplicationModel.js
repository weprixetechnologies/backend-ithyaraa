const db = require('../utils/dbconnect');

let tableEnsured = false;

const ensureBrandApplicationsTable = async () => {
    if (tableEnsured) return;
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS brand_applications (
              id                    INT AUTO_INCREMENT PRIMARY KEY,
              ref_id                VARCHAR(30)  NOT NULL UNIQUE,
              brand_name            VARCHAR(255) NOT NULL,
              website               VARCHAR(500) NOT NULL,
              product_type          VARCHAR(50)  NOT NULL DEFAULT 'fashion',
              address               TEXT         NOT NULL,
              interests             JSON         NOT NULL,
              partnership_type      JSON         DEFAULT NULL,
              dropship_status       VARCHAR(20)  DEFAULT 'no',
              monthly_order_volume  VARCHAR(100) DEFAULT NULL,
              goals                 TEXT         DEFAULT NULL,
              lookbook_name         VARCHAR(500) DEFAULT NULL,
              lookbook_url          TEXT         DEFAULT NULL,
              contact_name          VARCHAR(255) NOT NULL,
              contact_position      VARCHAR(255) DEFAULT NULL,
              contact_email         VARCHAR(255) NOT NULL,
              contact_phone         VARCHAR(50)  NOT NULL,
              consent               TINYINT(1)   NOT NULL DEFAULT 0,
              status                ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
              brand_uid             VARCHAR(100) DEFAULT NULL,
              submitted_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
              reviewed_at           DATETIME     DEFAULT NULL,
              reviewed_by           VARCHAR(100) DEFAULT NULL,
              notes                 TEXT         DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        tableEnsured = true;
    } catch (err) {
        console.error('Failed to ensure brand_applications table:', err.message);
    }
};

/**
 * Insert a new brand application
 * @param {Object} data
 * @returns {Object} Inserted row id
 */
const createApplication = async (data) => {
    await ensureBrandApplicationsTable();
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
    await ensureBrandApplicationsTable();
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
    await ensureBrandApplicationsTable();
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
    await ensureBrandApplicationsTable();
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
    await ensureBrandApplicationsTable();
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
