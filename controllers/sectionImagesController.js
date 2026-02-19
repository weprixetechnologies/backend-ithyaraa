const service = require('../services/sectionImagesService');

const addImages = async (req, res) => {
  try {
    const { sectionID } = req.params;
    const images = req.body.images || [];
    const result = await service.addImagesService(sectionID, images);
    if (!result.success) return res.status(400).json(result);
    return res.status(201).json(result);
  } catch (error) {
    console.error('controller.addImages error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const listImages = async (req, res) => {
  try {
    const { sectionID } = req.params;
    const result = await service.listImagesService(sectionID);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('controller.listImages error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const updateImage = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await service.updateImageService(id, req.body);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('controller.updateImage error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await service.deleteImageService(id);
    if (!result.success) return res.status(404).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('controller.deleteImage error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  addImages,
  listImages,
  updateImage,
  deleteImage
};

