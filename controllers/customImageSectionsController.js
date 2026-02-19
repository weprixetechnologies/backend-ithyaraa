const service = require('../services/customImageSectionsService');

const createSection = async (req, res) => {
  try {
    const result = await service.createSectionService(req.body);
    if (!result.success) return res.status(400).json(result);
    return res.status(201).json(result);
  } catch (error) {
    console.error('controller.createSection error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const listSections = async (req, res) => {
  try {
    const result = await service.listSectionsService(req.query);
    if (!result.success) return res.status(500).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('controller.listSections error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const getSection = async (req, res) => {
  try {
    const result = await service.getSectionService(req.params.id);
    if (!result.success) return res.status(404).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('controller.getSection error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const updateSection = async (req, res) => {
  try {
    const result = await service.updateSectionService(req.params.id, req.body);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('controller.updateSection error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const deleteSection = async (req, res) => {
  try {
    const result = await service.deleteSectionService(req.params.id);
    if (!result.success) return res.status(404).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('controller.deleteSection error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  createSection,
  listSections,
  getSection,
  updateSection,
  deleteSection
};

