const db = require('../utils/dbconnect');

const createSection = async ({ sectionID = null, title = null, imageUrl = null, layoutID = null, isBannerised = false }) => {
  try {
    const [result] = await db.query(
      `INSERT INTO custom_image_sections (sectionID, title, imageUrl, layoutID, isBannerised) VALUES (?, ?, ?, ?, ?)`,
      [sectionID, title, imageUrl, layoutID, isBannerised ? 1 : 0]
    );
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('model.createSection error', error);
    return { success: false, error: error.message };
  }
};

const getSectionByID = async (id) => {
  try {
    const [rows] = await db.query('SELECT * FROM custom_image_sections WHERE id = ?', [id]);
    if (rows.length === 0) return { success: false, message: 'Section not found' };
    return { success: true, data: rows[0] };
  } catch (error) {
    console.error('model.getSectionByID error', error);
    return { success: false, error: error.message };
  }
};

const listSections = async ({ page = 1, limit = 20 } = {}) => {
  try {
    const offset = (page - 1) * limit;
    const [countRows] = await db.query('SELECT COUNT(*) as total FROM custom_image_sections');
    const total = countRows[0].total;
    const [rows] = await db.query('SELECT * FROM custom_image_sections ORDER BY createdAt DESC LIMIT ? OFFSET ?', [limit, offset]);
    return { success: true, data: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  } catch (error) {
    console.error('model.listSections error', error);
    return { success: false, error: error.message };
  }
};

const updateSection = async (id, payload = {}) => {
  try {
    const updates = [];
    const values = [];
    if (payload.sectionID !== undefined) { updates.push('sectionID = ?'); values.push(payload.sectionID); }
    if (payload.title !== undefined) { updates.push('title = ?'); values.push(payload.title); }
    if (payload.imageUrl !== undefined) { updates.push('imageUrl = ?'); values.push(payload.imageUrl); }
    if (payload.layoutID !== undefined) { updates.push('layoutID = ?'); values.push(payload.layoutID); }
    if (payload.isBannerised !== undefined) { updates.push('isBannerised = ?'); values.push(payload.isBannerised ? 1 : 0); }
    if (updates.length === 0) return { success: false, message: 'No fields to update' };
    values.push(id);
    const [result] = await db.query(`UPDATE custom_image_sections SET ${updates.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) return { success: false, message: 'Section not found' };
    return { success: true };
  } catch (error) {
    console.error('model.updateSection error', error);
    return { success: false, error: error.message };
  }
};

const deleteSection = async (id) => {
  try {
    const [result] = await db.query('DELETE FROM custom_image_sections WHERE id = ?', [id]);
    if (result.affectedRows === 0) return { success: false, message: 'Section not found' };
    return { success: true };
  } catch (error) {
    console.error('model.deleteSection error', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createSection,
  getSectionByID,
  listSections,
  updateSection,
  deleteSection
};

