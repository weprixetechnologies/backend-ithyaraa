const model = require('../model/customImageSectionsModel');

const createSectionService = async (data) => {
  try {
    if (!data) return { success: false, message: 'Invalid payload' };
    const result = await model.createSection(data);
    if (!result.success) return { success: false, message: 'Failed to create', error: result.error };
    const created = await model.getSectionByID(result.id);
    return { success: true, message: 'Section created', data: created.success ? created.data : { id: result.id } };
  } catch (error) {
    console.error('service.createSectionService', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const listSectionsService = async (query = {}) => {
  try {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const result = await model.listSections({ page, limit });
    if (!result.success) return { success: false, message: 'Failed to fetch', error: result.error };
    return { success: true, data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } };
  } catch (error) {
    console.error('service.listSectionsService', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const getSectionService = async (id) => {
  try {
    const result = await model.getSectionByID(id);
    if (!result.success) return { success: false, message: result.message || 'Not found' };
    return { success: true, data: result.data };
  } catch (error) {
    console.error('service.getSectionService', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const updateSectionService = async (id, data) => {
  try {
    const result = await model.updateSection(id, data);
    if (!result.success) return { success: false, message: result.message || 'Failed to update', error: result.error };
    const updated = await model.getSectionByID(id);
    return { success: true, message: 'Updated', data: updated.success ? updated.data : null };
  } catch (error) {
    console.error('service.updateSectionService', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const deleteSectionService = async (id) => {
  try {
    const result = await model.deleteSection(id);
    if (!result.success) return { success: false, message: result.message || 'Failed to delete', error: result.error };
    return { success: true, message: 'Deleted' };
  } catch (error) {
    console.error('service.deleteSectionService', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

module.exports = {
  createSectionService,
  listSectionsService,
  getSectionService,
  updateSectionService,
  deleteSectionService
};

