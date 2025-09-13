const commonService = require('../services/index');

const getCountController = async (req, res) => {
    const { dataType } = req.query;
    console.log(dataType);
    console.log(req.query);



    if (!dataType) {
        console.log(req.query);
        return res.status(400).json({ success: false, message: 'tableName is required' });
    }

    // Remove tableName from filters
    const { ...filters } = req.query;
    delete filters.dataType;

    const result = await commonService.getCountService({ tableName: dataType, filters });
    console.log(result);

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(500).json(result);
    }
};

module.exports = {
    getCountController
};

// Filters controller: categories from categories table
async function getFiltersController(req, res) {
    try {
        const result = await commonService.getFiltersService();
        return res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
        console.error('getFiltersController error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

module.exports.getFiltersController = getFiltersController;
