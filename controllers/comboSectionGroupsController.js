const service = require('../services/comboSectionGroupsService');

const createGroup = async (req, res) => {
  try {
    const payload = req.body;
    const result = await service.createGroupService(payload);
    if (!result.success) return res.status(400).json(result);
    return res.status(201).json(result);
  } catch (error) {
    console.error('comboSectionGroupsController.createGroup error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const addProducts = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { productIDs } = req.body;
    const result = await service.addProductsService(groupId, productIDs);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('comboSectionGroupsController.addProducts error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const replaceProducts = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { productIDs } = req.body;
    const result = await service.replaceProductsService(groupId, productIDs);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('comboSectionGroupsController.replaceProducts error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const payload = req.body;
    const result = await service.updateGroupService(groupId, payload);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('comboSectionGroupsController.updateGroup error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const result = await service.deleteGroupService(groupId);
    if (!result.success) return res.status(404).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('comboSectionGroupsController.deleteGroup error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const getGroupByID = async (req, res) => {
  try {
    const { groupId } = req.params;
    const result = await service.getGroupByIDService(groupId);
    if (!result.success) return res.status(404).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('comboSectionGroupsController.getGroupByID error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const listGroups = async (req, res) => {
  try {
    const result = await service.listGroupsService(req.query);
    if (!result.success) return res.status(500).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('comboSectionGroupsController.listGroups error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const getGroupProducts = async (req, res) => {
  try {
    const { groupId } = req.params;
    const result = await service.getGroupProductsService(groupId);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('comboSectionGroupsController.getGroupProducts error', error);
    return { success: false, message: 'Internal server error', error: error.message };
  }
};

module.exports = {
  createGroup,
  addProducts,
  replaceProducts,
  updateGroup,
  deleteGroup,
  getGroupByID,
  listGroups,
  getGroupProducts
};
