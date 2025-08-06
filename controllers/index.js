const commonService = require('../services/index');

const getCountController = async (req, res) => {
    const { dataType } = req.query;
    console.log(dataType);


    if (!dataType) {
        return res.status(400).json({ success: false, message: 'tableName is required' });
    }

    // Remove tableName from filters
    const { ...filters } = req.query;
    delete filters.dataType;

    const result = await commonService.getCountService({ tableName: dataType, filters });

    if (result.success) {
        res.status(200).json(result);
    } else {
        res.status(500).json(result);
    }
};

module.exports = {
    getCountController
};
