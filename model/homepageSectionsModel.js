const db = require('../utils/dbconnect');

/**
 * Create a new homepage section
 */
const createSection = async (sectionData) => {
    try {
        const { title, image, link, routeTo, filters, position, isActive, fallbackLink } = sectionData;

        // Convert filters object to JSON string if it's an object
        const filtersJson = filters ? JSON.stringify(filters) : null;

        const [result] = await db.query(
            `INSERT INTO homepage_sections (title, image, link, routeTo, filters, position, isActive, fallbackLink) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title || null, image, link || null, routeTo || null, filtersJson, position || 0, isActive !== undefined ? isActive : true, fallbackLink || null]
        );

        return {
            success: true,
            id: result.insertId
        };
    } catch (error) {
        console.error('Error creating homepage section:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get all sections with optional pagination and sorting
 */
const getAllSections = async ({ page = 1, limit = 10, sortBy = 'position', sortDir = 'ASC' } = {}) => {
    try {
        const offset = (page - 1) * limit;

        // Validate sortBy to prevent SQL injection
        const allowedSortFields = ['id', 'position', 'createdAt', 'updatedAt', 'title'];
        const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'position';
        const sortDirection = sortDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        // Get total count
        const [countResult] = await db.query('SELECT COUNT(*) as total FROM homepage_sections');
        const total = countResult[0].total;

        // Get paginated sections
        const [rows] = await db.query(
            `SELECT 
                id,
                title,
                image,
                link,
                routeTo,
                filters,
                position,
                isActive,
                fallbackLink,
                createdAt,
                updatedAt
             FROM homepage_sections 
             ORDER BY ${sortField} ${sortDirection}
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        // Parse JSON filters for each section
        const sections = rows.map(row => ({
            ...row,
            filters: row.filters ? JSON.parse(row.filters) : null,
            isActive: Boolean(row.isActive)
        }));

        return {
            success: true,
            data: sections,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    } catch (error) {
        console.error('Error getting all homepage sections:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get only active sections (for frontend)
 */
const getActiveSections = async () => {
    try {
        const [rows] = await db.query(
            `SELECT 
                id,
                title,
                image,
                link,
                routeTo,
                filters,
                position,
                isActive,
                fallbackLink,
                createdAt,
                updatedAt
             FROM homepage_sections 
             WHERE isActive = TRUE
             ORDER BY position ASC`
        );

        // Parse JSON filters for each section
        const sections = rows.map(row => ({
            ...row,
            filters: row.filters ? JSON.parse(row.filters) : null,
            isActive: Boolean(row.isActive)
        }));

        return {
            success: true,
            data: sections
        };
    } catch (error) {
        console.error('Error getting active homepage sections:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get section by ID
 */
const getSectionByID = async (id) => {
    try {
        const [rows] = await db.query(
            `SELECT 
                id,
                title,
                image,
                link,
                routeTo,
                filters,
                position,
                isActive,
                fallbackLink,
                createdAt,
                updatedAt
             FROM homepage_sections 
             WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return {
                success: false,
                message: 'Section not found'
            };
        }

        const section = {
            ...rows[0],
            filters: rows[0].filters ? JSON.parse(rows[0].filters) : null,
            isActive: Boolean(rows[0].isActive)
        };

        return {
            success: true,
            data: section
        };
    } catch (error) {
        console.error('Error getting homepage section by ID:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Update section by ID
 */
const updateSection = async (id, sectionData) => {
    try {
        const { title, image, link, routeTo, filters, position, isActive } = sectionData;

        // Build update query dynamically based on provided fields
        const updates = [];
        const values = [];

        if (title !== undefined) {
            updates.push('title = ?');
            values.push(title);
        }
        if (image !== undefined) {
            updates.push('image = ?');
            values.push(image);
        }
        if (link !== undefined) {
            updates.push('link = ?');
            values.push(link);
        }
        if (routeTo !== undefined) {
            updates.push('routeTo = ?');
            values.push(routeTo);
        }
        if (filters !== undefined) {
            updates.push('filters = ?');
            values.push(filters ? JSON.stringify(filters) : null);
        }
        if (position !== undefined) {
            updates.push('position = ?');
            values.push(position);
        }
        if (isActive !== undefined) {
            updates.push('isActive = ?');
            values.push(isActive);
        }
        if (sectionData.fallbackLink !== undefined) {
            updates.push('fallbackLink = ?');
            values.push(sectionData.fallbackLink);
        }

        if (updates.length === 0) {
            return {
                success: false,
                message: 'No fields to update'
            };
        }

        values.push(id);

        const [result] = await db.query(
            `UPDATE homepage_sections 
             SET ${updates.join(', ')} 
             WHERE id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return {
                success: false,
                message: 'Section not found'
            };
        }

        return {
            success: true,
            message: 'Section updated successfully'
        };
    } catch (error) {
        console.error('Error updating homepage section:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Delete section by ID
 */
const deleteSection = async (id) => {
    try {
        const [result] = await db.query(
            'DELETE FROM homepage_sections WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return {
                success: false,
                message: 'Section not found'
            };
        }

        return {
            success: true,
            message: 'Section deleted successfully'
        };
    } catch (error) {
        console.error('Error deleting homepage section:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Update section status (enable/disable)
 */
const updateSectionStatus = async (id, isActive) => {
    try {
        const [result] = await db.query(
            'UPDATE homepage_sections SET isActive = ? WHERE id = ?',
            [isActive, id]
        );

        if (result.affectedRows === 0) {
            return {
                success: false,
                message: 'Section not found'
            };
        }

        return {
            success: true,
            message: `Section ${isActive ? 'enabled' : 'disabled'} successfully`
        };
    } catch (error) {
        console.error('Error updating homepage section status:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    createSection,
    getAllSections,
    getActiveSections,
    getSectionByID,
    updateSection,
    deleteSection,
    updateSectionStatus
};
