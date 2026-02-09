const service = require('../services/faqService');

// ---------- Admin ----------

async function create(req, res) {
    try {
        const result = await service.createFaq(req.body);
        if (!result.success) return res.status(400).json(result);
        return res.status(201).json(result);
    } catch (e) {
        console.error('faqController.create', e);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

async function list(req, res) {
    try {
        const result = await service.getPaginated(req.query);
        return res.status(200).json(result);
    } catch (e) {
        console.error('faqController.list', e);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

async function getOne(req, res) {
    try {
        const result = await service.getById(req.params.id);
        if (!result.success) return res.status(404).json(result);
        return res.status(200).json(result);
    } catch (e) {
        console.error('faqController.getOne', e);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

async function update(req, res) {
    try {
        const result = await service.updateFaq(req.params.id, req.body);
        if (!result.success) return res.status(400).json(result);
        return res.status(200).json(result);
    } catch (e) {
        console.error('faqController.update', e);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

async function remove(req, res) {
    try {
        const result = await service.deleteFaq(req.params.id);
        if (!result.success) return res.status(404).json(result);
        return res.status(200).json(result);
    } catch (e) {
        console.error('faqController.remove', e);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

async function toggle(req, res) {
    try {
        const result = await service.toggleFaq(req.params.id);
        if (!result.success) return res.status(404).json(result);
        return res.status(200).json({ success: true, data: { is_active: result.is_active } });
    } catch (e) {
        console.error('faqController.toggle', e);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

async function reorder(req, res) {
    try {
        const result = await service.reorderFaqs(req.body);
        if (!result.success) return res.status(400).json(result);
        return res.status(200).json(result);
    } catch (e) {
        console.error('faqController.reorder', e);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

// ---------- Public (no backend cache; frontend uses ISR) ----------

async function listPublic(req, res) {
    try {
        const data = await service.getActiveForPublic();
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400');
        return res.status(200).json(data);
    } catch (e) {
        console.error('faqController.listPublic', e);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

module.exports = {
    create,
    list,
    getOne,
    update,
    remove,
    toggle,
    reorder,
    listPublic,
};
