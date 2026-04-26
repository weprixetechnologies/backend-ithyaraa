const model = require('../model/featuredBlocksModel');

/**
 * Public: get featured blocks for frontend
 */
const getActive = async (req, res) => {
    try {
        const result = await model.getActive();
        if (!result.success) {
            return res.status(500).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getActive featured blocks controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Admin: get all featured blocks
 */
const getAll = async (req, res) => {
    try {
        const result = await model.getAll();
        if (!result.success) {
            return res.status(500).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getAll featured blocks controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Admin: create featured block
 */
const create = async (req, res) => {
    try {
        const result = await model.create(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(201).json(result);
    } catch (error) {
        console.error('Error in create featured block controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Admin: delete featured block
 */
const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.deleteById(id);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in remove featured block controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Admin: update featured block
 */
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.updateById(id, req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in update featured block controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Admin: reorder blocks
 */
const reorder = async (req, res) => {
    try {
        const { order } = req.body;
        const result = await model.reorder(order);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in reorder featured blocks controller:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    getActive,
    getAll,
    create,
    remove,
    update,
    reorder
};
