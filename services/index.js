const commonModel = require('../model/index')

const getCountService = async ({ tableName, filters }) => {
    try {
        const total = await commonModel.getTableCount({ tableName, filters });
        return {
            success: true,
            total
        };
    } catch (error) {
        console.error('getCountService error:', error);
        return {
            success: false,
            message: 'Failed to count items',
            error: error.message
        };
    }
};

module.exports = { getCountService }