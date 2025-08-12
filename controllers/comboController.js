const comboService = require('./../services/comboService')

const createComboProduct = async (req, res) => {
    try {
        const result = await comboService.createComboProduct(req.body);
        res.status(201).json({
            success: true,
            message: 'Combo product created successfully',
            comboID: result.comboID
        });
    } catch (error) {
        console.error('Error creating combo product:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

async function getCombobyID(req, res) {
    try {
        const { comboID } = req.params;

        // Validate comboID
        if (!comboID || comboID.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'comboID parameter is required'
            });
        }

        const comboData = await comboService.fetchComboWithProducts(comboID);

        return res.status(200).json({
            success: true,
            data: comboData
        });

    } catch (error) {
        console.error('Error fetching combo:', error.message);

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Internal server error',
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
}
async function editCombo(req, res) {
    try {
        const { comboID, products, ...updateData } = req.body;

        if (!comboID) {
            return res.status(400).json({ success: false, message: "comboID is required" });
        }

        if (!Array.isArray(products)) {
            return res.status(400).json({ success: false, message: "products must be an array of comboIDs" });
        }

        const result = await comboService.editComboProduct(comboID, updateData, products);

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error("Error editing combo:", error.message);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
}

const deleteComboController = async (req, res) => {
    try {
        const { comboID } = req.params;

        if (!comboID) {
            return res.status(400).json({ message: 'comboID is required' });
        }

        const result = await comboService.deleteCombo(comboID);
        return res.status(200).json(result);

    } catch (error) {
        console.error('Error deleting combo:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
module.exports = { createComboProduct, getCombobyID, editCombo, deleteComboController }