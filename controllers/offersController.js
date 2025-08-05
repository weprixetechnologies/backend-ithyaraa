const model = require('./../model/offersModel');

const fetchOfferbyName = async (req, res) => {
    try {
        const { name } = req.query;

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ message: 'Invalid or missing offer name' });
        }

        const search = await model.findOffersByName(name);

        res.status(200).json({
            message: 'Fetch Successful',
            result: search
        });
    } catch (error) {
        console.error('Error fetching offer by name:', error);
        res.status(500).json({
            message: 'Server error while fetching offer',
            error: error.message
        });
    }
};

module.exports = { fetchOfferbyName };
