const db = require('../utils/dbconnect');

/**
 * Create a new product group
 */
const createGroup = async ({ sectionID, orderIndex = 0, imageUrl = null, isBannerised = false, title = null }) => {
  try {
    const [result] = await db.query(
      `INSERT INTO product_groups (sectionID, orderIndex, imageUrl, isBannerised, title)
       VALUES (?, ?, ?, ?, ?)`,
      [sectionID, orderIndex, imageUrl, isBannerised ? 1 : 0, title]
    );

    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('model.createGroup error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Add multiple products to a group (appends). Skips duplicates.
 */
const addProductsToGroup = async (groupID, productIDs = []) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // verify group exists
    const [gRows] = await connection.query('SELECT id FROM product_groups WHERE id = ?', [groupID]);
    if (gRows.length === 0) {
      await connection.rollback();
      connection.release();
      return { success: false, message: 'Group not found' };
    }

    // Normalize incoming IDs to strings and filter empties
    const incoming = productIDs.map(p => (p === null || p === undefined ? '' : String(p).trim())).filter(p => p.length > 0);
    if (incoming.length === 0) {
      await connection.rollback();
      connection.release();
      return { success: false, message: 'No valid productIDs provided' };
    }

    // Fetch existing productIDs for this group to avoid re-inserting duplicates
    const [existingRows] = await connection.query('SELECT productID FROM group_products WHERE groupID = ?', [groupID]);
    const existingSet = new Set(existingRows.map(r => String(r.productID)));

    const toInsert = incoming.filter(p => !existingSet.has(p));
    if (toInsert.length === 0) {
      // nothing to add
      await connection.commit();
      connection.release();
      return { success: true, message: 'No new products to add' };
    }

    // determine starting position (max position + 1)
    const [posRows] = await connection.query('SELECT COALESCE(MAX(position), -1) AS maxpos FROM group_products WHERE groupID = ?', [groupID]);
    let pos = (posRows[0] && posRows[0].maxpos !== null) ? posRows[0].maxpos + 1 : 0;

    // prepare bulk values only for new ones
    const values = toInsert.map(pid => [groupID, pid, pos++]);
    if (values.length > 0) {
      await connection.query('INSERT INTO group_products (groupID, productID, position) VALUES ?', [values]);
    }

    await connection.commit();
    connection.release();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('model.addProductsToGroup error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Replace group products entirely (delete old, insert new)
 */
const replaceGroupProducts = async (groupID, productIDs = []) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // verify group exists
    const [gRows] = await connection.query('SELECT id FROM product_groups WHERE id = ?', [groupID]);
    if (gRows.length === 0) {
      await connection.rollback();
      connection.release();
      return { success: false, message: 'Group not found' };
    }

    // delete existing
    await connection.query('DELETE FROM group_products WHERE groupID = ?', [groupID]);

    // insert new with positions
    const values = productIDs.map((pid, idx) => [groupID, pid, idx]);
    if (values.length > 0) {
      await connection.query('INSERT INTO group_products (groupID, productID, position) VALUES ?', [values]);
    }

    await connection.commit();
    connection.release();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('model.replaceGroupProducts error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a group (cascade will remove group_products via FK)
 */
const deleteGroup = async (groupID) => {
  try {
    const [result] = await db.query('DELETE FROM product_groups WHERE id = ?', [groupID]);
    if (result.affectedRows === 0) {
      return { success: false, message: 'Group not found' };
    }
    return { success: true };
  } catch (error) {
    console.error('model.deleteGroup error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update group metadata
 */
const updateGroup = async (groupID, data = {}) => {
  try {
    const updates = [];
    const values = [];

    if (data.sectionID !== undefined) {
      updates.push('sectionID = ?');
      values.push(data.sectionID);
    }
    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.orderIndex !== undefined) {
      updates.push('orderIndex = ?');
      values.push(data.orderIndex);
    }
    if (data.imageUrl !== undefined) {
      updates.push('imageUrl = ?');
      values.push(data.imageUrl);
    }
    if (data.isBannerised !== undefined) {
      updates.push('isBannerised = ?');
      values.push(data.isBannerised ? 1 : 0);
    }

    if (updates.length === 0) {
      return { success: false, message: 'No fields to update' };
    }

    values.push(groupID);
    const sql = `UPDATE product_groups SET ${updates.join(', ')} WHERE id = ?`;
    const [result] = await db.query(sql, values);
    if (result.affectedRows === 0) {
      return { success: false, message: 'Group not found' };
    }
    return { success: true };
  } catch (error) {
    console.error('model.updateGroup error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get group by ID with products (optional)
 */
const getGroupByID = async (groupID) => {
  try {
    const [rows] = await db.query('SELECT * FROM product_groups WHERE id = ?', [groupID]);
    if (rows.length === 0) return { success: false, message: 'Group not found' };
    const group = rows[0];
    const [products] = await db.query('SELECT productID, position FROM group_products WHERE groupID = ? ORDER BY position ASC', [groupID]);
    return { success: true, data: { ...group, products } };
  } catch (error) {
    console.error('model.getGroupByID error', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createGroup,
  addProductsToGroup,
  replaceGroupProducts,
  deleteGroup,
  updateGroup,
  getGroupByID
};
/**
 * List groups with optional pagination and optional inclusion of products.
 * options: { page, limit, sectionID, includeProducts }
 */
const listGroups = async ({ page = 1, limit = 20, sectionID = null, includeProducts = false } = {}) => {
  try {
    const offset = (page - 1) * limit;
    let where = '';
    const params = [];
    if (sectionID !== null && sectionID !== undefined) {
      where = 'WHERE sectionID = ?';
      params.push(sectionID);
    }

    // total count
    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM product_groups ${where}`, params);
    const total = countRows[0] ? countRows[0].total : 0;

    // fetch page
    const [rows] = await db.query(
      `SELECT id, sectionID, title, orderIndex, imageUrl, isBannerised, createdAt, updatedAt
       FROM product_groups
       ${where}
       ORDER BY orderIndex ASC, id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const groups = rows;

    if (includeProducts && groups.length > 0) {
      const groupIDs = groups.map(g => g.id);
      const placeholders = groupIDs.map(() => '?').join(',');
      const [prodRows] = await db.query(
        `SELECT groupID, productID, position FROM group_products WHERE groupID IN (${placeholders}) ORDER BY groupID, position ASC`,
        groupIDs
      );

      const map = prodRows.reduce((acc, p) => {
        acc[p.groupID] = acc[p.groupID] || [];
        acc[p.groupID].push({ productID: p.productID, position: p.position });
        return acc;
      }, {});

      const groupsWithProducts = groups.map(g => ({
        ...g,
        products: map[g.id] || []
      }));

      return { success: true, data: groupsWithProducts, total, page, limit };
    }

    return { success: true, data: groups, total, page, limit };
  } catch (error) {
    console.error('model.listGroups error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get only products for a group
 */
const getGroupProducts = async (groupID) => {
  try {
    const [rows] = await db.query('SELECT productID, position FROM group_products WHERE groupID = ? ORDER BY position ASC', [groupID]);
    return { success: true, data: rows };
  } catch (error) {
    console.error('model.getGroupProducts error', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createGroup,
  addProductsToGroup,
  replaceGroupProducts,
  deleteGroup,
  updateGroup,
  getGroupByID,
  listGroups,
  getGroupProducts
};

