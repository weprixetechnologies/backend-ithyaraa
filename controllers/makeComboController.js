const makeComboService = require('./../services/makeComboService')

const createComboProduct = async (req, res) => {
    console.log(req.body);

    try {
        const { type } = req.body;

        if (type !== 'make_combo') {
            return res.status(400).json({ success: false, message: 'Invalid type. Only "make_combo" is allowed.' });
        }

        const result = await makeComboService.createCombo(req.body);

        res.status(201).json({ success: true, message: 'Combo created successfully', comboID: result.comboID });
    } catch (error) {
        console.error('Error creating combo:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const getComboDetailsController = async (req, res) => {
    try {
        const { comboID } = req.params;

        const combo = await makeComboService.getComboDetails(comboID);

        if (!combo) {
            return res.status(404).json({ message: 'Combo not found' });
        }

        return res.status(200).json(combo);
    } catch (err) {
        console.error('Error fetching combo details:', err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getComboDetailsForUserController = async (req, res) => {
    try {
        const { productID } = req.params;

        // Validate productID
        if (!productID || productID.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'productID parameter is required'
            });
        }

        const combo = await makeComboService.getComboDetailsForUser(productID);

        if (!combo) {
            return res.status(404).json({
                success: false,
                message: 'Make-combo not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: combo
        });

    } catch (error) {
        console.error('Error fetching make-combo details for user:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
};
const editComboProduct = async (req, res) => {
    try {
        const { ...updateData } = req.body;
        console.log(updateData);
        const { comboID } = req.params
        if (!comboID) {
            return res.status(400).json({ error: 'Missing comboID' });
        }

        await makeComboService.updateComboProduct(comboID, updateData);
        res.status(200).json({ message: 'Combo product updated successfully' });
    } catch (error) {
        console.error('Error editing combo product:', error);
        res.status(500).json({ error: 'Failed to update combo product' });
    }
};

module.exports = { createComboProduct, getComboDetailsController, getComboDetailsForUserController, editComboProduct };
