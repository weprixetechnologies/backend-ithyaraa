const supportModel = require('../model/supportModel');
const topicService = require('../services/topicService');

const getAdminTopics = async (req, res) => {
    try {
        const topics = await supportModel.getAllTopics();
        const tree = buildTree(topics);
        res.status(200).json({ success: true, topics: tree });
    } catch (err) {
        console.error('Admin get topics error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const buildTree = (items, parentId = null) => {
    return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
            ...item,
            children: buildTree(items, item.id)
        }));
};

const createTopic = async (req, res) => {
    try {
        const { parent_id, panel, label, input_type, prefilled_text, sort_order, is_active } = req.body;
        
        if (!label) {
            return res.status(400).json({ success: false, message: 'Label is required' });
        }

        const slug = label.toLowerCase().replace(/\s+/g, '-');
        const id = await supportModel.createTopic({
            parent_id,
            panel,
            label,
            slug,
            input_type,
            prefilled_text,
            sort_order,
            is_active
        });

        // Bust Redis Cache
        await topicService.bustCache();

        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error('Admin create topic error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const patchTopic = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (updateData.label) {
            updateData.slug = updateData.label.toLowerCase().replace(/\s+/g, '-');
        }

        await supportModel.updateTopic(id, updateData);
        
        // Bust Redis Cache
        await topicService.bustCache();

        res.status(200).json({ success: true, message: 'Topic updated' });
    } catch (err) {
        console.error('Admin patch topic error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const deleteTopic = async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete
        await supportModel.updateTopic(id, { is_active: false });
        
        // Bust Redis Cache
        await topicService.bustCache();

        res.status(200).json({ success: true, message: 'Topic deactivated' });
    } catch (err) {
        console.error('Admin delete topic error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getAdminTopics,
    createTopic,
    patchTopic,
    deleteTopic
};
