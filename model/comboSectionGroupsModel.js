const db = require('../utils/dbconnect');

/**
 * Create a new combo section group
 */
const createGroup = async ({ sectionID, orderIndex = 0, imageUrl = null, isBannerised = false, title = null }) => {
  try {
    const [result] = await db.query(
      `INSERT INTO combo_section_groups (sectionID, orderIndex, imageUrl, isBannerised, title)
       VALUES (?, ?, ?, ?, ?)`,
      [sectionID, orderIndex, imageUrl, isBannerised ? 1 : 0, title]
    );

    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('comboSectionGroupsModel.createGroup error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Add multiple combo products to a group (appends). Skips duplicates.
 */
const addProductsToGroup = async (groupID, comboProductIDs = []) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // verify group exists
    const [gRows] = await connection.query('SELECT id FROM combo_section_groups WHERE id = ?', [groupID]);
    if (gRows.length === 0) {
      await connection.rollback();
      connection.release();
      return { success: false, message: 'Group not found' };
    }

    // Normalize incoming IDs to strings and filter empties
    const incoming = comboProductIDs.map(p => (p === null || p === undefined ? '' : String(p).trim())).filter(p => p.length > 0);
    if (incoming.length === 0) {
      await connection.rollback();
      connection.release();
      return { success: false, message: 'No valid comboProductIDs provided' };
    }

    // Fetch existing comboProductIDs for this group to avoid re-inserting duplicates
    const [existingRows] = await connection.query('SELECT comboProductID FROM combo_section_group_products WHERE groupID = ?', [groupID]);
    const existingSet = new Set(existingRows.map(r => String(r.comboProductID)));

    const toInsert = incoming.filter(p => !existingSet.has(p));
    if (toInsert.length === 0) {
      await connection.commit();
      connection.release();
      return { success: true, message: 'No new products to add' };
    }

    // determine starting position (max position + 1)
    const [posRows] = await connection.query('SELECT COALESCE(MAX(position), -1) AS maxpos FROM combo_section_group_products WHERE groupID = ?', [groupID]);
    let pos = (posRows[0] && posRows[0].maxpos !== null) ? posRows[0].maxpos + 1 : 0;

    // prepare bulk values only for new ones
    const values = toInsert.map(pid => [groupID, pid, pos++]);
    if (values.length > 0) {
      await connection.query('INSERT INTO combo_section_group_products (groupID, comboProductID, position) VALUES ?', [values]);
    }

    await connection.commit();
    connection.release();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('comboSectionGroupsModel.addProductsToGroup error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Replace group products entirely (delete old, insert new)
 */
const replaceGroupProducts = async (groupID, comboProductIDs = []) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // verify group exists
    const [gRows] = await connection.query('SELECT id FROM combo_section_groups WHERE id = ?', [groupID]);
    if (gRows.length === 0) {
      await connection.rollback();
      connection.release();
      return { success: false, message: 'Group not found' };
    }

    // delete existing
    await connection.query('DELETE FROM combo_section_group_products WHERE groupID = ?', [groupID]);

    // insert new with positions
    const values = comboProductIDs.map((pid, idx) => [groupID, pid, idx]);
    if (values.length > 0) {
      await connection.query('INSERT INTO combo_section_group_products (groupID, comboProductID, position) VALUES ?', [values]);
    }

    await connection.commit();
    connection.release();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('comboSectionGroupsModel.replaceGroupProducts error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a group (cascade will remove combo_section_group_products via FK)
 */
const deleteGroup = async (groupID) => {
  try {
    const [result] = await db.query('DELETE FROM combo_section_groups WHERE id = ?', [groupID]);
    if (result.affectedRows === 0) {
      return { success: false, message: 'Group not found' };
    }
    return { success: true };
  } catch (error) {
    console.error('comboSectionGroupsModel.deleteGroup error', error);
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
    const sql = `UPDATE combo_section_groups SET ${updates.join(', ')} WHERE id = ?`;
    const [result] = await db.query(sql, values);
    if (result.affectedRows === 0) {
      return { success: false, message: 'Group not found' };
    }
    return { success: true };
  } catch (error) {
    console.error('comboSectionGroupsModel.updateGroup error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get group by ID with products
 */
const getGroupByID = async (groupID) => {
  try {
    const [rows] = await db.query('SELECT * FROM combo_section_groups WHERE id = ?', [groupID]);
    if (rows.length === 0) return { success: false, message: 'Group not found' };
    const group = rows[0];
    const [products] = await db.query(
      `SELECT gp.comboProductID, gp.position, p.name, p.regularPrice, p.salePrice, p.featuredImage
       FROM combo_section_group_products gp
       LEFT JOIN products p ON p.productID = gp.comboProductID
       WHERE gp.groupID = ?
       ORDER BY gp.position ASC`,
      [groupID]
    );

    const parsedProducts = products.map(p => {
      let parsedImg = p.featuredImage;
      try {
        if (typeof p.featuredImage === 'string' && p.featuredImage.trim().length > 0) {
          parsedImg = JSON.parse(p.featuredImage);
        }
      } catch (e) {
        parsedImg = p.featuredImage;
      }
      return { ...p, featuredImage: parsedImg };
    });

    return { success: true, data: { ...group, products: parsedProducts } };
  } catch (error) {
    console.error('comboSectionGroupsModel.getGroupByID error', error);
    return { success: false, error: error.message };
  }
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
    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM combo_section_groups ${where}`, params);
    const total = countRows[0] ? countRows[0].total : 0;

    // fetch page
    const [rows] = await db.query(
      `SELECT id, sectionID, title, orderIndex, imageUrl, isBannerised, createdAt, updatedAt
       FROM combo_section_groups
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
        `SELECT gp.groupID, gp.comboProductID, gp.position, p.name, p.regularPrice, p.salePrice, p.featuredImage
         FROM combo_section_group_products gp
         LEFT JOIN products p ON p.productID = gp.comboProductID
         WHERE gp.groupID IN (${placeholders})
         ORDER BY gp.groupID, gp.position ASC`,
        groupIDs
      );

      const map = prodRows.reduce((acc, p) => {
        let parsedImg = p.featuredImage;
        try {
          if (typeof p.featuredImage === 'string' && p.featuredImage.trim().length > 0) {
            parsedImg = JSON.parse(p.featuredImage);
          }
        } catch (e) {
          parsedImg = p.featuredImage;
        }

        acc[p.groupID] = acc[p.groupID] || [];
        acc[p.groupID].push({
          comboProductID: p.comboProductID,
          position: p.position,
          name: p.name,
          regularPrice: p.regularPrice,
          salePrice: p.salePrice,
          featuredImage: parsedImg
        });
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
    console.error('comboSectionGroupsModel.listGroups error', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get only products for a group
 */
const getGroupProducts = async (groupID) => {
  try {
    const [rows] = await db.query(
      `SELECT gp.comboProductID, gp.position, p.name, p.regularPrice, p.salePrice, p.featuredImage
       FROM combo_section_group_products gp
       LEFT JOIN products p ON p.productID = gp.comboProductID
       WHERE gp.groupID = ?
       ORDER BY gp.position ASC`,
      [groupID]
    );

    const parsedRows = rows.map(r => {
      let parsedImg = r.featuredImage;
      try {
        if (typeof r.featuredImage === 'string' && r.featuredImage.trim().length > 0) {
          parsedImg = JSON.parse(r.featuredImage);
        }
      } catch (e) {
        parsedImg = r.featuredImage;
      }
      return { ...r, featuredImage: parsedImg };
    });

    return { success: true, data: parsedRows };
  } catch (error) {
    console.error('comboSectionGroupsModel.getGroupProducts error', error);
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
