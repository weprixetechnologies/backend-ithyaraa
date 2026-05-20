const model = require('../model/offerSectionItemsModel');
const cisModel = require('../model/customImageSectionsModel');
const pgModel = require('../model/productGroupsModel');
const presalePgModel = require('../model/presaleSectionGroupsModel');
const comboPgModel = require('../model/comboSectionGroupsModel');
const { deleteCache, getCache, setCache } = require('../utils/cacheHelper');
const { SCOPE } = require('../utils/cacheScopes');

const createItem = async (req, res) => {
  try {
    const { id, type, order } = req.body;
    if (!id || !type) {
      return res.status(400).json({ success: false, message: 'id and type are required' });
    }

    let itemId = id;
    const t = String(type).trim().toLowerCase();
    if (t === 'imagesection') {
      const maybeNumeric = Number(id);
      if (!Number.isNaN(maybeNumeric)) {
        const cis = await cisModel.getSectionByID(maybeNumeric);
        if (cis && cis.success && cis.data && cis.data.sectionID) {
          itemId = cis.data.sectionID;
        }
      }
    } else if (t === 'presalesection' || t === 'presale section') {
      const maybeNumeric = Number(id);
      if (!Number.isNaN(maybeNumeric)) {
        const pg = await presalePgModel.getGroupByID(maybeNumeric);
        if (pg && pg.success && pg.data && pg.data.sectionID) {
          itemId = pg.data.sectionID;
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
    } else if (t === 'combosection' || t === 'combo section') {
      const maybeNumeric = Number(id);
      if (!Number.isNaN(maybeNumeric)) {
        const pg = await comboPgModel.getGroupByID(maybeNumeric);
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
    try { await deleteCache(SCOPE.OFFER_PAGE_DATA); } catch (e) { console.error(e); }
    return res.status(201).json({ success: true, id: result.id });
  } catch (error) {
    console.error('offerSectionItemsController.createItem error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const getItems = async (req, res) => {
  try {
    const type = req.query.type || null;
    if (!type) {
      const cached = await getCache(SCOPE.OFFER_PAGE_DATA);
      if (cached) {
        return res.status(200).json({ success: true, data: cached });
      }
    }

    const result = await model.listItems({ type });
    if (!result.success) {
      return res.status(500).json(result);
    }

    if (Array.isArray(result.data)) {
      result.data = result.data.map(item => {
        const title = item.section?.title || item.group?.title || item.title || null;
        return { ...item, title };
      });
    }

    if (!type) {
      try {
        await setCache(SCOPE.OFFER_PAGE_DATA, result.data);
      } catch (e) {
        console.error('Failed to set offer cache', e);
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('offerSectionItemsController.getItems error', error);
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
    try { await deleteCache(SCOPE.OFFER_PAGE_DATA); } catch (e) { console.error(e); }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('offerSectionItemsController.reorderItems error', error);
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
    console.error('offerSectionItemsController.getItem error', error);
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
    } else if (t === 'presalesection' || t === 'presale section') {
      const maybeNumeric = Number(incomingId);
      if (!Number.isNaN(maybeNumeric)) {
        const pg = await presalePgModel.getGroupByID(maybeNumeric);
        if (pg && pg.success && pg.data && pg.data.sectionID) {
          itemId = pg.data.sectionID;
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
    } else if (t === 'combosection' || t === 'combo section') {
      const maybeNumeric = Number(incomingId);
      if (!Number.isNaN(maybeNumeric)) {
        const pg = await comboPgModel.getGroupByID(maybeNumeric);
        if (pg && pg.success && pg.data && pg.data.sectionID) {
          itemId = pg.data.sectionID;
        }
      }
    }

    const orderIndex = order !== undefined && order !== null ? parseInt(order, 10) : undefined;
    const result = await model.updateItem(id, { itemId, type, orderIndex });
    if (!result.success) return res.status(400).json(result);
    try { await deleteCache(SCOPE.OFFER_PAGE_DATA); } catch (e) { console.error(e); }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('offerSectionItemsController.updateItem error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await model.deleteItem(id);
    if (!result.success) return res.status(404).json(result);
    try { await deleteCache(SCOPE.OFFER_PAGE_DATA); } catch (e) { console.error(e); }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('offerSectionItemsController.deleteItem error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

const clearCache = async (req, res) => {
  try {
    console.log('received request to clear offer cache');
    await deleteCache(SCOPE.OFFER_PAGE_DATA);
    return res.status(200).json({ success: true, message: 'Offer cache cleared' });
  } catch (error) {
    console.error('offerSectionItemsController.clearCache error', error);
    return res.status(500).json({ success: false, message: 'Failed to clear cache', error: error.message });
  }
};

module.exports = {
  createItem,
  getItems,
  reorderItems,
  getItem,
  updateItem,
  deleteItem,
  clearCache
};
