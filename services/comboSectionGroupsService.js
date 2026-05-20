const model = require('../model/comboSectionGroupsModel');
const db = require('../utils/dbconnect');

const validateComboProducts = async (comboProductIDs = []) => {
  const uniqueIDs = [...new Set(comboProductIDs.map(id => String(id).trim()).filter(Boolean))];
  if (uniqueIDs.length === 0) return uniqueIDs;

  const placeholders = uniqueIDs.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT productID, type FROM products WHERE productID IN (${placeholders})`,
    uniqueIDs
  );

  const foundMap = new Map(rows.map(r => [r.productID, r.type]));

  const missing = uniqueIDs.filter(id => !foundMap.has(id));
  if (missing.length > 0) {
    throw new Error(`The following product IDs do not exist: ${missing.join(', ')}`);
  }

  const nonCombos = uniqueIDs.filter(id => foundMap.get(id) !== 'combo');
  if (nonCombos.length > 0) {
    throw new Error(`Only combo products are allowed. The following are not combo products: ${nonCombos.join(', ')}`);
  }

  return uniqueIDs;
};

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
    console.error('comboSectionGroupsService.createGroupService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const addProductsService = async (groupID, comboProductIDs) => {
  try {
    const gid = parseInt(groupID, 10);
    if (Number.isNaN(gid)) return { success: false, message: 'Invalid groupID' };
    if (!Array.isArray(comboProductIDs) || comboProductIDs.length === 0) {
      return { success: false, message: 'comboProductIDs must be a non-empty array' };
    }

    let validated;
    try {
      validated = await validateComboProducts(comboProductIDs);
    } catch (valErr) {
      return { success: false, message: valErr.message };
    }

    const result = await model.addProductsToGroup(gid, validated);
    if (!result.success) return { success: false, message: 'Failed to add products', error: result.error || result.message };
    return { success: true, message: 'Combo products added to group' };
  } catch (error) {
    console.error('comboSectionGroupsService.addProductsService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const replaceProductsService = async (groupID, comboProductIDs) => {
  try {
    const gid = parseInt(groupID, 10);
    if (Number.isNaN(gid)) return { success: false, message: 'Invalid groupID' };
    if (!Array.isArray(comboProductIDs)) return { success: false, message: 'comboProductIDs must be an array' };

    let validated;
    try {
      validated = await validateComboProducts(comboProductIDs);
    } catch (valErr) {
      return { success: false, message: valErr.message };
    }

    const result = await model.replaceGroupProducts(gid, validated);
    if (!result.success) return { success: false, message: 'Failed to replace products', error: result.error || result.message };
    return { success: true, message: 'Group products replaced' };
  } catch (error) {
    console.error('comboSectionGroupsService.replaceProductsService error', error);
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
    console.error('comboSectionGroupsService.updateGroupService error', error);
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
    console.error('comboSectionGroupsService.deleteGroupService error', error);
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
    console.error('comboSectionGroupsService.getGroupByIDService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

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
    console.error('comboSectionGroupsService.listGroupsService error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

const getGroupProductsService = async (groupID) => {
  try {
    const gid = parseInt(groupID, 10);
    if (Number.isNaN(gid)) return { success: false, message: 'Invalid groupID' };
    const result = await model.getGroupProducts(gid);
    if (!result.success) return { success: false, message: 'Failed to fetch products', error: result.error };
    return { success: true, data: result.data };
  } catch (error) {
    console.error('comboSectionGroupsService.getGroupProductsService error', error);
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
