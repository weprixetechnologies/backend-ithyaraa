const reelsModel = require('../model/reelsModel');

/**
 * Add a new reel
 */
const addReel = async (req, res) => {
    try {
        const { video_url, thumbnail_url, position, isActive } = req.body;

        if (!video_url) {
            return res.status(400).json({ success: false, message: 'Video URL is required' });
        }

        const result = await reelsModel.createReel({ video_url, thumbnail_url, position, isActive });

        if (result.success) {
            return res.status(201).json({ success: true, message: 'Reel added successfully', id: result.id });
        } else {
            return res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error in addReel controller:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * List all reels for admin
 */
const listReelsAdmin = async (req, res) => {
    try {
        const result = await reelsModel.getAllReels();

        if (result.success) {
            return res.status(200).json({ success: true, data: result.data });
        } else {
            return res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error in listReelsAdmin controller:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * List active reels for public (Home Page)
 */
const listReelsPublic = async (req, res) => {
    try {
        const result = await reelsModel.getActiveReels();

        if (result.success) {
            return res.status(200).json({ success: true, data: result.data });
        } else {
            return res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error in listReelsPublic controller:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get reel by ID
 */
const getReelByID = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await reelsModel.getReelByID(id);

        if (result.success) {
            return res.status(200).json({ success: true, data: result.data });
        } else {
            return res.status(404).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error('Error in getReelByID controller:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Update a reel
 */
const updateReel = async (req, res) => {
    try {
        const { id } = req.params;
        const reelData = req.body;

        const result = await reelsModel.updateReel(id, reelData);

        if (result.success) {
            return res.status(200).json({ success: true, message: result.message });
        } else {
            return res.status(404).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error('Error in updateReel controller:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Delete a reel
 */
const deleteReel = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await reelsModel.deleteReel(id);

        if (result.success) {
            return res.status(200).json({ success: true, message: result.message });
        } else {
            return res.status(404).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error('Error in deleteReel controller:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Toggle reel status (Active/Disable)
 */
const toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (isActive === undefined) {
            return res.status(400).json({ success: false, message: 'Status (isActive) is required' });
        }

        const result = await reelsModel.updateReelStatus(id, isActive === true || isActive === 'true');

        if (result.success) {
            return res.status(200).json({ success: true, message: result.message });
        } else {
            return res.status(404).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error('Error in toggleStatus controller:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Reorder reels
 */
const reorderReels = async (req, res) => {
    try {
        const { positions } = req.body; // Array of { id, position }

        if (!Array.isArray(positions)) {
            return res.status(400).json({ success: false, message: 'Positions must be an array' });
        }

        const result = await reelsModel.updateReelPositions(positions);

        if (result.success) {
            return res.status(200).json({ success: true, message: result.message });
        } else {
            return res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error in reorderReels controller:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    addReel,
    listReelsAdmin,
    listReelsPublic,
    getReelByID,
    updateReel,
    deleteReel,
    toggleStatus,
    reorderReels
};
