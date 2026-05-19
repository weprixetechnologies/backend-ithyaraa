const service = require('../services/presaleSectionGroupsService');

const createGroup = async (req, res) => {
  try {
    const payload = req.body;
    const result = await service.createGroupService(payload);
    if (!result.success) return res.status(400).json(result);
    return res.status(201).json(result);
  } catch (error) {
    console.error('presaleSectionGroupsController.createGroup error', error);
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
    console.error('presaleSectionGroupsController.addProducts error', error);
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
    console.error('presaleSectionGroupsController.replaceProducts error', error);
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
    console.error('presaleSectionGroupsController.updateGroup error', error);
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
    console.error('presaleSectionGroupsController.deleteGroup error', error);
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
    console.error('presaleSectionGroupsController.getGroupByID error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const listGroups = async (req, res) => {
  try {
    const result = await service.listGroupsService(req.query);
    if (!result.success) return res.status(500).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('presaleSectionGroupsController.listGroups error', error);
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
    console.error('presaleSectionGroupsController.getGroupProducts error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
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
