const db = require('../utils/dbconnect');

/**
 * Create a new FAQ
 */
const create = async ({ question, answer_html, is_active = true, sort_order }) => {
    const [result] = await db.query(
        `INSERT INTO faqs (question, answer_html, is_active, sort_order)
         VALUES (?, ?, ?, ?)`,
        [question, answer_html, is_active ? 1 : 0, sort_order ?? 0]
    );
    return { success: true, id: result.insertId };
};

/**
 * Get all FAQs with pagination (Admin) - ordered by sort_order ASC, then id
 */
const getAll = async ({ page = 1, limit = 20 }) => {
    const offset = (page - 1) * limit;
    const [countRows] = await db.query('SELECT COUNT(*) AS total FROM faqs');
    const total = countRows[0].total;

    const [rows] = await db.query(
        `SELECT id, question, answer_html, is_active, sort_order, created_at, updated_at
         FROM faqs
         ORDER BY sort_order ASC, id ASC
         LIMIT ? OFFSET ?`,
        [limit, offset]
    );

    const data = rows.map((r) => ({
        id: r.id,
        question: r.question,
        answer_html: r.answer_html,
        is_active: Boolean(r.is_active),
        sort_order: r.sort_order,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }));

    return {
        success: true,
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};

/**
 * Get only active FAQs ordered by sort_order (for public API) - no pagination
 */
const getActiveForPublic = async () => {
    const [rows] = await db.query(
        `SELECT id, question, answer_html
         FROM faqs
         WHERE is_active = 1
         ORDER BY sort_order ASC, id ASC`
    );
    return rows.map((r) => ({
        id: r.id,
        question: r.question,
        answer_html: r.answer_html,
    }));
};

/**
 * Get single FAQ by ID
 */
const getById = async (id) => {
    const [rows] = await db.query(
        `SELECT id, question, answer_html, is_active, sort_order, created_at, updated_at
         FROM faqs WHERE id = ?`,
        [id]
    );
    if (rows.length === 0) return { success: false, message: 'FAQ not found' };
    const r = rows[0];
    return {
        success: true,
        data: {
            id: r.id,
            question: r.question,
            answer_html: r.answer_html,
            is_active: Boolean(r.is_active),
            sort_order: r.sort_order,
            created_at: r.created_at,
            updated_at: r.updated_at,
        },
    };
};

/**
 * Update FAQ by ID
 */
const update = async (id, { question, answer_html, is_active, sort_order }) => {
    const updates = [];
    const values = [];
    if (question !== undefined) {
        updates.push('question = ?');
        values.push(question);
    }
    if (answer_html !== undefined) {
        updates.push('answer_html = ?');
        values.push(answer_html);
    }
    if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active ? 1 : 0);
    }
    if (sort_order !== undefined) {
        updates.push('sort_order = ?');
        values.push(sort_order);
    }
    if (updates.length === 0) return { success: false, message: 'No fields to update' };
    values.push(id);
    const [result] = await db.query(
        `UPDATE faqs SET ${updates.join(', ')} WHERE id = ?`,
        values
    );
    if (result.affectedRows === 0) return { success: false, message: 'FAQ not found' };
    return { success: true };
};

/**
 * Delete FAQ by ID
 */
const remove = async (id) => {
    const [result] = await db.query('DELETE FROM faqs WHERE id = ?', [id]);
    if (result.affectedRows === 0) return { success: false, message: 'FAQ not found' };
    return { success: true };
};

/**
 * Toggle is_active
 */
const toggleActive = async (id) => {
    const [rows] = await db.query('SELECT is_active FROM faqs WHERE id = ?', [id]);
    if (rows.length === 0) return { success: false, message: 'FAQ not found' };
    const newActive = rows[0].is_active ? 0 : 1;
    await db.query('UPDATE faqs SET is_active = ? WHERE id = ?', [newActive, id]);
    return { success: true, is_active: Boolean(newActive) };
};

/**
 * Bulk update sort_order (for drag-and-drop reorder)
 * payload: [{ id, sort_order }, ...]
 */
const updateOrder = async (items) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        for (const { id, sort_order } of items) {
            await conn.query('UPDATE faqs SET sort_order = ? WHERE id = ?', [sort_order, id]);
        }
        await conn.commit();
        return { success: true };
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

/**
 * Get max sort_order (for assigning new items at the end)
 */
const getMaxSortOrder = async () => {
    const [rows] = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS mx FROM faqs');
    return Number(rows[0]?.mx) || 0;
};

module.exports = {
    create,
    getAll,
    getActiveForPublic,
    getById,
    update,
    remove,
    toggleActive,
    updateOrder,
    getMaxSortOrder,
};
