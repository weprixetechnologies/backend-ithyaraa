const db = require('../utils/dbconnect');

const addImages = async (sectionID, images = []) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [sRows] = await connection.query('SELECT id FROM custom_image_sections WHERE id = ?', [sectionID]);
    if (sRows.length === 0) {
      await connection.rollback();
      connection.release();
      return { success: false, message: 'Section not found' };
    }

    const [posRows] = await connection.query('SELECT COALESCE(MAX(position), -1) AS maxpos FROM section_images WHERE section_id = ?', [sectionID]);
    let pos = (posRows[0] && posRows[0].maxpos !== null) ? posRows[0].maxpos + 1 : 0;

    const values = images.map(img => [sectionID, img.routeTo || null, img.filters ? JSON.stringify(img.filters) : null, img.imageUrl || null, pos++]);
    if (values.length > 0) {
      await connection.query('INSERT INTO section_images (section_id, routeTo, filters, imageUrl, position) VALUES ?', [values]);
    }

    await connection.commit();
    connection.release();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('model.addImages error', error);
    return { success: false, error: error.message };
  }
};

const listImagesBySection = async (sectionID) => {
  try {
    const [rows] = await db.query('SELECT * FROM section_images WHERE section_id = ? ORDER BY position ASC', [sectionID]);
    return { success: true, data: rows };
  } catch (error) {
    console.error('model.listImagesBySection error', error);
    return { success: false, error: error.message };
  }
};

const updateImage = async (id, payload = {}) => {
  try {
    const updates = [];
    const values = [];
    if (payload.routeTo !== undefined) { updates.push('routeTo = ?'); values.push(payload.routeTo); }
    if (payload.filters !== undefined) { updates.push('filters = ?'); values.push(payload.filters ? JSON.stringify(payload.filters) : null); }
    if (payload.imageUrl !== undefined) { updates.push('imageUrl = ?'); values.push(payload.imageUrl); }
    if (payload.position !== undefined) { updates.push('position = ?'); values.push(payload.position); }
    if (updates.length === 0) return { success: false, message: 'No fields to update' };
    values.push(id);
    const [result] = await db.query(`UPDATE section_images SET ${updates.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) return { success: false, message: 'Image not found' };
    return { success: true };
  } catch (error) {
    console.error('model.updateImage error', error);
    return { success: false, error: error.message };
  }
};

const deleteImage = async (id) => {
  try {
    const [result] = await db.query('DELETE FROM section_images WHERE id = ?', [id]);
    if (result.affectedRows === 0) return { success: false, message: 'Image not found' };
    return { success: true };
  } catch (error) {
    console.error('model.deleteImage error', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  addImages,
  listImagesBySection,
  updateImage,
  deleteImage
};

