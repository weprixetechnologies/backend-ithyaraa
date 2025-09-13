const commonModel = require('../model/index')
const categoryModel = require('../model/categoryModel')

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

// Return all filters for shop: categories now come from categories table
async function getFiltersService() {
    try {
        const categories = await categoryModel.getAllCategoryNamesIDs();
        return {
            success: true,
            data: {
                categories
            }
        };
    } catch (error) {
        console.error('getFiltersService error:', error);
        return {
            success: false,
            message: 'Failed to fetch filters',
            error: error.message
        };
    }
}

module.exports.getFiltersService = getFiltersService;