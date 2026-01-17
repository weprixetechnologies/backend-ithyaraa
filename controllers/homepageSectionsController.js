const service = require('../services/homepageSectionsService');

/**
 * Create a new homepage section (Admin)
 */
const createSection = async (req, res) => {
    try {
        const sectionData = req.body;

        const result = await service.createSectionService(sectionData);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error('Error in createSection controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Get all sections with pagination (Admin)
 */
const getAllSections = async (req, res) => {
    try {
        const result = await service.getAllSectionsService(req.query);

        if (!result.success) {
            return res.status(500).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getAllSections controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Get active sections (Frontend - Public)
 */
const getActiveSections = async (req, res) => {
    try {
        const result = await service.getActiveSectionsService();

        if (!result.success) {
            return res.status(500).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getActiveSections controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Get section by ID
 */
const getSectionByID = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await service.getSectionByIDService(id);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getSectionByID controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Update section (Admin)
 */
const updateSection = async (req, res) => {
    try {
        const { id } = req.params;
        const sectionData = req.body;

        const result = await service.updateSectionService(id, sectionData);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in updateSection controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Delete section (Admin)
 */
const deleteSection = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await service.deleteSectionService(id);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in deleteSection controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Update section status - Enable/Disable (Admin)
 */
const updateSectionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isActive must be a boolean value'
            });
        }

        const result = await service.updateSectionStatusService(id, isActive);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in updateSectionStatus controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
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
