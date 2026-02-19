const model = require('../model/sectionImagesModel');

const addImagesService = async (sectionID, images = []) => {
  try {
    if (!sectionID) return { success: false, message: 'sectionID required' };
    if (!Array.isArray(images) || images.length === 0) return { success: false, message: 'images must be a non-empty array' };
    const result = await model.addImages(sectionID, images);
    if (!result.success) return { success: false, message: 'Failed to add images', error: result.error || result.message };
    return { success: true, message: 'Images added' };
  } catch (error) {
    console.error('service.addImagesService', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const listImagesService = async (sectionID) => {
  try {
    if (!sectionID) return { success: false, message: 'sectionID required' };
    const result = await model.listImagesBySection(sectionID);
    if (!result.success) return { success: false, message: 'Failed to fetch images', error: result.error };
    return { success: true, data: result.data };
  } catch (error) {
    console.error('service.listImagesService', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const updateImageService = async (id, payload) => {
  try {
    const result = await model.updateImage(id, payload);
    if (!result.success) return { success: false, message: result.message || 'Failed to update', error: result.error };
    return { success: true, message: 'Updated' };
  } catch (error) {
    console.error('service.updateImageService', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const deleteImageService = async (id) => {
  try {
    const result = await model.deleteImage(id);
    if (!result.success) return { success: false, message: result.message || 'Failed to delete', error: result.error };
    return { success: true, message: 'Deleted' };
  } catch (error) {
    console.error('service.deleteImageService', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

module.exports = {
  addImagesService,
  listImagesService,
  updateImageService,
  deleteImageService
};

