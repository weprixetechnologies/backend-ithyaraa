const model = require('../model/faqModel');
const { sanitizeHtml } = require('../utils/sanitizeHtml');

/**
 * Create FAQ (Admin)
 */
async function createFaq(body) {
    const { question, answer_html, is_active = true, sort_order } = body;
    if (!question || typeof question !== 'string' || !question.trim()) {
        return { success: false, message: 'question is required' };
    }
    const sanitized = sanitizeHtml(answer_html || '');
    let order = sort_order;
    if (order === undefined || order === null) {
        order = (await model.getMaxSortOrder()) + 1;
    }
    const result = await model.create({
        question: question.trim(),
        answer_html: sanitized || '<p></p>',
        is_active: Boolean(is_active),
        sort_order: Number(order) || 0,
    });
    if (!result.success) return result;
    const get = await model.getById(result.id);
    return { success: true, data: get.data, message: 'FAQ created' };
}

/**
 * Get paginated FAQs (Admin)
 */
async function getPaginated(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    return model.getAll({ page, limit });
}

/**
 * Get one FAQ by ID (Admin)
 */
async function getById(id) {
    const result = await model.getById(id);
    if (!result.success) return result;
    return { success: true, data: result.data };
}

/**
 * Update FAQ (Admin)
 */
async function updateFaq(id, body) {
    const existing = await model.getById(id);
    if (!existing.success) return { success: false, message: 'FAQ not found' };
    const updates = {};
    if (body.question !== undefined) {
        if (typeof body.question !== 'string' || !body.question.trim()) {
            return { success: false, message: 'question cannot be empty' };
        }
        updates.question = body.question.trim();
    }
    if (body.answer_html !== undefined) {
        updates.answer_html = sanitizeHtml(body.answer_html);
        if (!updates.answer_html) updates.answer_html = '<p></p>';
    }
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
    if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order);
    if (Object.keys(updates).length === 0) {
        return { success: true, data: existing.data, message: 'No changes' };
    }
    const result = await model.update(id, updates);
    if (!result.success) return result;
    const get = await model.getById(id);
    return { success: true, data: get.data, message: 'FAQ updated' };
}

/**
 * Delete FAQ (Admin)
 */
async function deleteFaq(id) {
    return model.remove(id);
}

/**
 * Toggle is_active (Admin)
 */
async function toggleFaq(id) {
    return model.toggleActive(id);
}

/**
 * Reorder FAQs (Admin) - body: { order: [{ id, sort_order }, ...] }
 */
async function reorderFaqs(body) {
    const items = body.order;
    if (!Array.isArray(items) || items.length === 0) {
        return { success: false, message: 'order array is required' };
    }
    await model.updateOrder(items);
    return { success: true, message: 'Order updated' };
}

/**
 * Get active FAQs for public (used by public API; cache lives in controller layer)
 */
async function getActiveForPublic() {
    return model.getActiveForPublic();
}

module.exports = {
    createFaq,
    getPaginated,
    getById,
    updateFaq,
    deleteFaq,
    toggleFaq,
    reorderFaqs,
    getActiveForPublic,
};
