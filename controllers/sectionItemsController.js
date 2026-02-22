const model = require('../model/sectionItemsModel');
const cisModel = require('../model/customImageSectionsModel');
const pgModel = require('../model/productGroupsModel');
// const cacheHelper = require('../utils/cacheHelper');
const { deleteCache, getCache, setCache } = require('../utils/cacheHelper');
const { SCOPE } = require('../utils/cacheScopes');

const createItem = async (req, res) => {
  try {
    const { id, type, order } = req.body;
    if (!id || !type) {
      return res.status(400).json({ success: false, message: 'id and type are required' });
    }

    // Resolve incoming id to the canonical itemId expected by section_items:
    // - For imagesection: use custom_image_sections.sectionID
    // - For productsection: use product_groups.sectionID
    let itemId = id;
    const t = String(type).trim().toLowerCase();
    if (t === 'imagesection') {
      // if frontend sent cis.id, resolve to cis.sectionID
      const maybeNumeric = Number(id);
      if (!Number.isNaN(maybeNumeric)) {
        const cis = await cisModel.getSectionByID(maybeNumeric);
        if (cis && cis.success && cis.data && cis.data.sectionID) {
          itemId = cis.data.sectionID;
        }
      }
    } else if (t === 'productsection' || t === 'product section') {
      const maybeNumeric = Number(id);
      if (!Number.isNaN(maybeNumeric)) {
        const pg = await pgModel.getGroupByID(maybeNumeric);
        if (pg && pg.success && pg.data && pg.data.sectionID) {
          itemId = pg.data.sectionID;
        }
      }
    }

    const orderIndex = order !== undefined && order !== null ? parseInt(order, 10) : 0;

    const result = await model.createItem({ itemId, type, orderIndex });
    if (!result.success) {
      return res.status(500).json(result);
    }
    return res.status(201).json({ success: true, id: result.id });
  } catch (error) {
    console.error('sectionItemsController.createItem error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const getItems = async (req, res) => {
  try {
    const type = req.query.type || null;
    // If no type specified, treat as home API and use home cache
    if (!type) {
      const cached = await getCache(SCOPE.HOME_DATA);
      if (cached) {
        return res.status(200).json({ success: true, data: cached });
      }
    }

    const result = await model.listItems({ type });
    if (!result.success) {
      return res.status(500).json(result);
    }

    // attach top-level title for convenience (from section.title or group.title)
    if (Array.isArray(result.data)) {
      result.data = result.data.map(item => {
        const title = item.section?.title || item.group?.title || item.title || null;
        return { ...item, title };
      });
    }

    // cache home data when no type specified
    if (!type) {
      try {
        await setCache(SCOPE.HOME_DATA, result.data);
      } catch (e) {
        console.error('Failed to set home cache', e);
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('sectionItemsController.getItems error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const reorderItems = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items must be an array' });
    }
    const result = await model.reorderItems(items);
    if (!result.success) {
      return res.status(500).json(result);
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('sectionItemsController.reorderItems error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const getItem = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await model.getItemById(id);
    if (!result.success) return res.status(404).json(result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('sectionItemsController.getItem error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: incomingId, type, order } = req.body;
    let itemId = incomingId;
    const t = typeof type === 'string' ? String(type).trim().toLowerCase() : null;
    if (t === 'imagesection') {
      const maybeNumeric = Number(incomingId);
      if (!Number.isNaN(maybeNumeric)) {
        const cis = await cisModel.getSectionByID(maybeNumeric);
        if (cis && cis.success && cis.data && cis.data.sectionID) {
          itemId = cis.data.sectionID;
        }
      }
    } else if (t === 'productsection' || t === 'product section') {
      const maybeNumeric = Number(incomingId);
      if (!Number.isNaN(maybeNumeric)) {
        const pg = await pgModel.getGroupByID(maybeNumeric);
        if (pg && pg.success && pg.data && pg.data.sectionID) {
          itemId = pg.data.sectionID;
        }
      }
    }

    const orderIndex = order !== undefined && order !== null ? parseInt(order, 10) : undefined;
    const result = await model.updateItem(id, { itemId, type, orderIndex });
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('sectionItemsController.updateItem error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await model.deleteItem(id);
    if (!result.success) return res.status(404).json(result);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('sectionItemsController.deleteItem error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const clearCache = async (req, res) => {
  try {
    console.log('received request to clear cache');

    await deleteCache(SCOPE.HOME_DATA);
    return res.status(200).json({ success: true, message: 'Home cache cleared' });
  } catch (error) {
    console.error('sectionItemsController.clearCache error', error);
    return res.status(500).json({ success: false, message: 'Failed to clear cache', error: error.message });
  }
};

module.exports = {
  createItem,
  getItems,
  reorderItems,
  getItem,
  updateItem,
  deleteItem
  , clearCache
};

