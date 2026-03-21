const db = require('../utils/dbconnect');

/**
 * Create a new reel
 */
const createReel = async (reelData) => {
    try {
        const { video_url, thumbnail_url, position, isActive } = reelData;

        const [result] = await db.query(
            `INSERT INTO reels (video_url, thumbnail_url, position, isActive) 
             VALUES (?, ?, ?, ?)`,
            [video_url, thumbnail_url || null, position || 0, isActive !== undefined ? isActive : true]
        );

        return {
            success: true,
            id: result.insertId
        };
    } catch (error) {
        console.error('Error creating reel:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get all reels for admin
 */
const getAllReels = async () => {
    try {
        const [rows] = await db.query(
            `SELECT id, video_url, thumbnail_url, position, isActive, createdAt, updatedAt 
             FROM reels 
             ORDER BY position ASC`
        );

        return {
            success: true,
            data: rows
        };
    } catch (error) {
        console.error('Error getting all reels:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get active reels for public
 */
const getActiveReels = async () => {
    try {
        const [rows] = await db.query(
            `SELECT id, video_url, thumbnail_url, position, isActive, createdAt, updatedAt 
             FROM reels 
             WHERE isActive = TRUE 
             ORDER BY position ASC`
        );

        return {
            success: true,
            data: rows
        };
    } catch (error) {
        console.error('Error getting active reels:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Get reel by ID
 */
const getReelByID = async (id) => {
    try {
        const [rows] = await db.query(
            `SELECT id, video_url, thumbnail_url, position, isActive, createdAt, updatedAt 
             FROM reels 
             WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return {
                success: false,
                message: 'Reel not found'
            };
        }

        return {
            success: true,
            data: rows[0]
        };
    } catch (error) {
        console.error('Error getting reel by ID:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Update reel by ID
 */
const updateReel = async (id, reelData) => {
    try {
        const { video_url, thumbnail_url, position, isActive } = reelData;

        const updates = [];
        const values = [];

        if (video_url !== undefined) {
            updates.push('video_url = ?');
            values.push(video_url);
        }
        if (thumbnail_url !== undefined) {
            updates.push('thumbnail_url = ?');
            values.push(thumbnail_url);
        }
        if (position !== undefined) {
            updates.push('position = ?');
            values.push(position);
        }
        if (isActive !== undefined) {
            updates.push('isActive = ?');
            values.push(isActive);
        }

        if (updates.length === 0) {
            return {
                success: false,
                message: 'No fields to update'
            };
        }

        values.push(id);

        const [result] = await db.query(
            `UPDATE reels SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return {
                success: false,
                message: 'Reel not found'
            };
        }

        return {
            success: true,
            message: 'Reel updated successfully'
        };
    } catch (error) {
        console.error('Error updating reel:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Delete reel by ID
 */
const deleteReel = async (id) => {
    try {
        const [result] = await db.query('DELETE FROM reels WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return {
                success: false,
                message: 'Reel not found'
            };
        }

        return {
            success: true,
            message: 'Reel deleted successfully'
        };
    } catch (error) {
        console.error('Error deleting reel:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Update reel status
 */
const updateReelStatus = async (id, isActive) => {
    try {
        const [result] = await db.query(
            'UPDATE reels SET isActive = ? WHERE id = ?',
            [isActive, id]
        );

        if (result.affectedRows === 0) {
            return {
                success: false,
                message: 'Reel not found'
            };
        }

        return {
            success: true,
            message: `Reel ${isActive ? 'enabled' : 'disabled'} successfully`
        };
    } catch (error) {
        console.error('Error updating reel status:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Update reel positions for drag and drop reordering
 */
const updateReelPositions = async (positions) => {
    try {
        // positions: [{ id, position }, ...]
        for (const item of positions) {
            await db.query('UPDATE reels SET position = ? WHERE id = ?', [item.position, item.id]);
        }

        return {
            success: true,
            message: 'Reel positions updated successfully'
        };
    } catch (error) {
        console.error('Error updating reel positions:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    createReel,
    getAllReels,
    getActiveReels,
    updateReel,
    deleteReel,
    updateReelStatus,
    updateReelPositions
};
