const service = require('../services/homepageTagSectionsService');

/**
 * Get all tag sections
 */
const getAllTagSections = async (req, res) => {
    try {
        const result = await service.getAllTagSections();
        if (!result.success) return res.status(500).json(result);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getAllTagSections:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create a new tag section
 */
const createTagSection = async (req, res) => {
    try {
        const { title, tag, description, position, isActive } = req.body;
        if (!title || !tag) {
            return res.status(400).json({ success: false, message: 'Title and tag are required' });
        }
        const result = await service.createSectionTag({ title, tag, description, position, isActive });
        if (!result.success) return res.status(400).json(result);
        return res.status(201).json(result);
    } catch (error) {
        console.error('Error in createTagSection:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update tag section
 */
const updateTagSection = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await service.updateSectionTag(id, req.body);
        if (!result.success) return res.status(400).json(result);
        return res.status(200).json({ success: true, message: 'Section updated successfully' });
    } catch (error) {
        console.error('Error in updateTagSection:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete tag section
 */
const deleteTagSection = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await service.deleteSectionTag(id);
        if (!result.success) return res.status(400).json(result);
        return res.status(200).json({ success: true, message: 'Section deleted successfully' });
    } catch (error) {
        console.error('Error in deleteTagSection:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get section products for live preview or homepage (cached)
 */
const getSectionProducts = async (req, res) => {
    try {
        const { tag } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const result = await service.getSectionProductsCached(tag, { page, limit });
        if (!result.success) return res.status(500).json(result);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getSectionProducts:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Bulk add tag to selected products
 */
const bulkAddTag = async (req, res) => {
    try {
        const { tag } = req.params;
        const { productIDs } = req.body;

        if (!Array.isArray(productIDs) || productIDs.length === 0) {
            return res.status(400).json({ success: false, message: 'productIDs array is required' });
        }

        const result = await service.bulkAddTag(tag, productIDs);
        if (!result.success) return res.status(400).json(result);
        return res.status(200).json({
            success: true,
            message: `Successfully tagged ${result.updatedCount} products with '${tag}'`,
            tag: result.tag,
            updatedCount: result.updatedCount
        });
    } catch (error) {
        console.error('Error in bulkAddTag:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Bulk remove tag from selected products
 */
const bulkRemoveTag = async (req, res) => {
    try {
        const { tag } = req.params;
        const { productIDs } = req.body;

        if (!Array.isArray(productIDs) || productIDs.length === 0) {
            return res.status(400).json({ success: false, message: 'productIDs array is required' });
        }

        const result = await service.bulkRemoveTag(tag, productIDs);
        if (!result.success) return res.status(400).json(result);
        return res.status(200).json({
            success: true,
            message: `Successfully removed tag '${tag}' from ${result.updatedCount} products`,
            tag: result.tag,
            updatedCount: result.updatedCount
        });
    } catch (error) {
        console.error('Error in bulkRemoveTag:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get active tag sections with products for public homepage (cached)
 */
const getActiveTagSections = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const result = await service.getActiveTagSectionsCached(limit);
        if (!result.success) return res.status(500).json(result);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getActiveTagSections:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getActiveTagSections,
    getAllTagSections,
    createTagSection,
    updateTagSection,
    deleteTagSection,
    getSectionProducts,
    bulkAddTag,
    bulkRemoveTag
};
