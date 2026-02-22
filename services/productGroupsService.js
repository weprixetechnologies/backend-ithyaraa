const model = require('../model/productGroupsModel');

const createGroupService = async (groupData) => {
  try {
    if (!groupData || typeof groupData.sectionID === 'undefined') {
      return { success: false, message: 'sectionID is required' };
    }

    const sectionID = parseInt(groupData.sectionID, 10);
    if (Number.isNaN(sectionID)) {
      return { success: false, message: 'sectionID must be a valid integer' };
    }

    const payload = {
      sectionID,
      title: groupData.title !== undefined ? (groupData.title === null ? null : String(groupData.title)) : undefined,
      orderIndex: groupData.orderIndex !== undefined ? parseInt(groupData.orderIndex, 10) : 0,
      imageUrl: groupData.imageUrl || null,
      isBannerised: !!groupData.isBannerised
    };

    const result = await model.createGroup(payload);
    if (!result.success) {
      return { success: false, message: 'Failed to create group', error: result.error };
    }

    const created = await model.getGroupByID(result.id);
    return { success: true, message: 'Group created', data: created.success ? created.data : { id: result.id } };
  } catch (error) {
    console.error('service.createGroupService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const addProductsService = async (groupID, productIDs) => {
  try {
    const gid = parseInt(groupID, 10);
    if (Number.isNaN(gid)) return { success: false, message: 'Invalid groupID' };
    if (!Array.isArray(productIDs) || productIDs.length === 0) return { success: false, message: 'productIDs must be a non-empty array' };

    // Accept string or numeric productIDs (do not coerce to int)
    const normalized = productIDs.map(p => (p === null || p === undefined ? '' : String(p).trim())).filter(p => p.length > 0);
    if (normalized.length === 0) return { success: false, message: 'No valid productIDs provided' };

    const result = await model.addProductsToGroup(gid, normalized);
    if (!result.success) return { success: false, message: 'Failed to add products', error: result.error || result.message };
    return { success: true, message: 'Products added to group' };
  } catch (error) {
    console.error('service.addProductsService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const replaceProductsService = async (groupID, productIDs) => {
  try {
    const gid = parseInt(groupID, 10);
    if (Number.isNaN(gid)) return { success: false, message: 'Invalid groupID' };
    if (!Array.isArray(productIDs)) return { success: false, message: 'productIDs must be an array' };
    const normalized = productIDs.map(p => (p === null || p === undefined ? '' : String(p).trim())).filter(p => p.length > 0);

    const result = await model.replaceGroupProducts(gid, normalized);
    if (!result.success) return { success: false, message: 'Failed to replace products', error: result.error || result.message };
    return { success: true, message: 'Group products replaced' };
  } catch (error) {
    console.error('service.replaceProductsService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const updateGroupService = async (groupID, data) => {
  try {
    const gid = parseInt(groupID, 10);
    if (Number.isNaN(gid)) return { success: false, message: 'Invalid groupID' };

    const payload = {};
    if (data.sectionID !== undefined) payload.sectionID = parseInt(data.sectionID, 10);
    if (data.title !== undefined) payload.title = data.title === null ? null : String(data.title);
    if (data.orderIndex !== undefined) payload.orderIndex = parseInt(data.orderIndex, 10);
    if (data.imageUrl !== undefined) payload.imageUrl = data.imageUrl;
    if (data.isBannerised !== undefined) payload.isBannerised = !!data.isBannerised;

    const result = await model.updateGroup(gid, payload);
    if (!result.success) return { success: false, message: 'Failed to update group', error: result.error || result.message };
    const updated = await model.getGroupByID(gid);
    return { success: true, message: 'Group updated', data: updated.success ? updated.data : null };
  } catch (error) {
    console.error('service.updateGroupService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const deleteGroupService = async (groupID) => {
  try {
    const gid = parseInt(groupID, 10);
    if (Number.isNaN(gid)) return { success: false, message: 'Invalid groupID' };

    const result = await model.deleteGroup(gid);
    if (!result.success) return { success: false, message: 'Failed to delete group', error: result.error || result.message };
    return { success: true, message: 'Group deleted' };
  } catch (error) {
    console.error('service.deleteGroupService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const getGroupByIDService = async (groupID) => {
  try {
    const gid = parseInt(groupID, 10);
    if (Number.isNaN(gid)) return { success: false, message: 'Invalid groupID' };
    const result = await model.getGroupByID(gid);
    if (!result.success) return { success: false, message: result.message || 'Group not found' };
    return { success: true, data: result.data };
  } catch (error) {
    console.error('service.getGroupByIDService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

module.exports = {
  createGroupService,
  addProductsService,
  replaceProductsService,
  updateGroupService,
  deleteGroupService,
  getGroupByIDService
};
/**
 * List groups service
 */
const listGroupsService = async (query = {}) => {
  try {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const sectionID = query.sectionID !== undefined ? (Number.isNaN(parseInt(query.sectionID, 10)) ? null : parseInt(query.sectionID, 10)) : null;
    const includeProducts = query.includeProducts === 'true' || query.includeProducts === true;

    const result = await model.listGroups({ page, limit, sectionID, includeProducts });
    if (!result.success) return { success: false, message: 'Failed to fetch groups', error: result.error };
    return { success: true, message: 'Groups fetched', data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total } };
  } catch (error) {
    console.error('service.listGroupsService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

/**
 * Get products for a group
 */
const getGroupProductsService = async (groupID) => {
  try {
    const gid = parseInt(groupID, 10);
    if (Number.isNaN(gid)) return { success: false, message: 'Invalid groupID' };
    const result = await model.getGroupProducts(gid);
    if (!result.success) return { success: false, message: 'Failed to fetch products', error: result.error };
    return { success: true, data: result.data };
  } catch (error) {
    console.error('service.getGroupProductsService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

module.exports = {
  createGroupService,
  addProductsService,
  replaceProductsService,
  updateGroupService,
  deleteGroupService,
  getGroupByIDService,
  listGroupsService,
  getGroupProductsService
};

