const db = require('../utils/dbconnect');

// Helper: convert various date inputs (including ISO) to MySQL DATETIME
function toMySQLDateTime(value) {
    if (!value) return null;
    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return null;
        // Format: YYYY-MM-DD HH:MM:SS
        return date.toISOString().slice(0, 19).replace('T', ' ');
    } catch {
        return null;
    }
}

// Helper: convert to MySQL DATE (YYYY-MM-DD)
function toMySQLDate(value) {
    if (!value) return null;
    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().slice(0, 10);
    } catch {
        return null;
    }
}

// Create presale group
const createPresaleGroup = async (groupData) => {
    try {
        const {
            presaleGroupID,
            groupName,
            description,
            bannerImage,
            featuredImage,
            startDate,
            endDate,
            expectedDeliveryDate,
            status = 'upcoming',
            groupDiscountType,
            groupDiscountValue,
            earlyBirdDiscount,
            earlyBirdEndDate,
            displayOrder = 0,
            isFeatured = 0,
            showOnHomepage = 1
        } = groupData;

        const query = `
            INSERT INTO presale_details (
                presaleGroupID, groupName, description, bannerImage, featuredImage,
                startDate, endDate, expectedDeliveryDate, status,
                groupDiscountType, groupDiscountValue, earlyBirdDiscount, earlyBirdEndDate,
                displayOrder, isFeatured, showOnHomepage
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            presaleGroupID,
            groupName,
            description || null,
            bannerImage ? JSON.stringify(bannerImage) : null,
            featuredImage ? JSON.stringify(featuredImage) : null,
            // Normalize date/datetime formats for MySQL
            toMySQLDateTime(startDate),
            toMySQLDateTime(endDate),
            toMySQLDate(expectedDeliveryDate),
            status,
            groupDiscountType || null,
            groupDiscountValue || null,
            earlyBirdDiscount || null,
            toMySQLDateTime(earlyBirdEndDate),
            displayOrder,
            isFeatured ? 1 : 0,
            showOnHomepage ? 1 : 0
        ];

        const [result] = await db.query(query, values);
        return {
            success: true,
            message: 'Presale group created successfully',
            id: result.insertId
        };
    } catch (error) {
        console.error('Error creating presale group:', error);
        throw error;
    }
};

// Get all presale groups
const getAllPresaleGroups = async (filters = {}) => {
    try {
        let whereConditions = [];
        let queryParams = [];

        if (filters.status) {
            whereConditions.push('status = ?');
            queryParams.push(filters.status);
        }

        if (filters.showOnHomepage !== undefined) {
            whereConditions.push('showOnHomepage = ?');
            queryParams.push(filters.showOnHomepage ? 1 : 0);
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const query = `
            SELECT * FROM presale_details 
            ${whereClause}
            ORDER BY displayOrder ASC, createdAt DESC
        `;

        const [rows] = await db.query(query, queryParams);
        // Ensure all groups have valid structure even if empty
        return rows.map(row => ({
            ...row,
            bannerImage: row.bannerImage || null,
            featuredImage: row.featuredImage || null,
            products: [] // Initialize empty products array for consistency
        }));
    } catch (error) {
        console.error('Error fetching presale groups:', error);
        throw error;
    }
};

// Get presale group by ID with products
const getPresaleGroupByID = async (presaleGroupID) => {
    try {
        // Get group details
        const [groupRows] = await db.query(
            'SELECT * FROM presale_details WHERE presaleGroupID = ?',
            [presaleGroupID]
        );

        if (groupRows.length === 0) {
            return null;
        }

        const group = groupRows[0];

        // Get products in this group
        const [productRows] = await db.query(
            `SELECT pp.*, pgp.displayOrder 
             FROM presale_group_products pgp
             INNER JOIN presale_products pp ON pgp.presaleProductID = pp.presaleProductID
             WHERE pgp.presaleGroupID = ?
             ORDER BY pgp.displayOrder ASC`,
            [presaleGroupID]
        );

        group.products = productRows;
        return group;
    } catch (error) {
        console.error('Error fetching presale group:', error);
        throw error;
    }
};

// Update presale group
const updatePresaleGroup = async (presaleGroupID, groupData) => {
    try {
        const updateFields = [];
        const values = [];

        // Fields that should NOT be updated
        const excludedFields = [
            'presaleGroupID',
            'id',
            'createdAt',
            'updatedAt',
            'products',
            'productIDs' // This is handled separately
        ];

        // Valid fields that can be updated
        const validFields = [
            'groupName',
            'description',
            'bannerImage',
            'featuredImage',
            'startDate',
            'endDate',
            'expectedDeliveryDate',
            'status',
            'groupDiscountType',
            'groupDiscountValue',
            'earlyBirdDiscount',
            'earlyBirdEndDate',
            'displayOrder',
            'isFeatured',
            'showOnHomepage'
        ];

        Object.keys(groupData).forEach(key => {
            // Skip excluded fields and only process valid fields
            if (
                !excludedFields.includes(key) &&
                validFields.includes(key) &&
                groupData[key] !== undefined
            ) {
                if (['bannerImage', 'featuredImage'].includes(key)) {
                    updateFields.push(`${key} = ?`);
                    values.push(JSON.stringify(groupData[key]));
                } else if (['isFeatured', 'showOnHomepage'].includes(key)) {
                    updateFields.push(`${key} = ?`);
                    values.push(groupData[key] ? 1 : 0);
                } else {
                    // Normalize date/datetime fields
                    if (['startDate', 'endDate', 'earlyBirdEndDate'].includes(key)) {
                        updateFields.push(`${key} = ?`);
                        values.push(toMySQLDateTime(groupData[key]));
                    } else if (key === 'expectedDeliveryDate') {
                        updateFields.push(`${key} = ?`);
                        values.push(toMySQLDate(groupData[key]));
                    } else {
                        updateFields.push(`${key} = ?`);
                        values.push(groupData[key]);
                    }
                }
            }
        });

        if (updateFields.length === 0) {
            return { success: false, message: 'No fields to update' };
        }

        values.push(presaleGroupID);

        const query = `
            UPDATE presale_details 
            SET ${updateFields.join(', ')}, updatedAt = NOW()
            WHERE presaleGroupID = ?
        `;

        const [result] = await db.query(query, values);
        return {
            success: result.affectedRows > 0,
            message: result.affectedRows > 0 ? 'Presale group updated successfully' : 'No changes made'
        };
    } catch (error) {
        console.error('Error updating presale group:', error);
        throw error;
    }
};

// Add products to presale group
const addProductsToGroup = async (presaleGroupID, productIDs) => {
    try {
        // Remove existing products from group
        await db.query(
            'DELETE FROM presale_group_products WHERE presaleGroupID = ?',
            [presaleGroupID]
        );

        // Add new products
        if (productIDs && productIDs.length > 0) {
            const insertValues = productIDs.map((productID, index) => [
                presaleGroupID,
                productID,
                index
            ]);

            const query = `
                INSERT INTO presale_group_products (presaleGroupID, presaleProductID, displayOrder)
                VALUES ?
            `;

            await db.query(query, [insertValues]);
        }

        return {
            success: true,
            message: 'Products added to group successfully'
        };
    } catch (error) {
        console.error('Error adding products to group:', error);
        throw error;
    }
};

// Delete presale group
const deletePresaleGroup = async (presaleGroupID) => {
    try {
        const [result] = await db.query(
            'DELETE FROM presale_details WHERE presaleGroupID = ?',
            [presaleGroupID]
        );
        return {
            success: result.affectedRows > 0,
            message: result.affectedRows > 0 ? 'Presale group deleted successfully' : 'Group not found'
        };
    } catch (error) {
        console.error('Error deleting presale group:', error);
        throw error;
    }
};

module.exports = {
    createPresaleGroup,
    getAllPresaleGroups,
    getPresaleGroupByID,
    updatePresaleGroup,
    addProductsToGroup,
    deletePresaleGroup
};

