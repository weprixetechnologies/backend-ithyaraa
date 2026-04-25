const model = require('../model/sliderBannersModel');

const getNextPosition = async (type) => {
    const res = await model.getAll({ type });
    if (!res.success || !res.data.length) return 0;
    const max = Math.max(...res.data.map(r => r.position ?? 0));
    return max + 1;
};

const createBanner = async (body) => {
    const { type, image_url, routeTo, minPrice, maxPrice, category, offer } = body;
    if (!type || !image_url) {
        return { success: false, message: 'type and image_url are required.' };
    }
    const position = body.position ?? await getNextPosition(type);
    return model.create({ type, image_url, position, routeTo, minPrice, maxPrice, category, offer });
};

const getActiveForFrontend = async () => {
    return model.getActiveByType();
};

const getAllBanners = async (query) => {
    return model.getAll(query);
};

const deleteBanner = async (id) => {
    return model.deleteById(id);
};

const reorderBanners = async (body) => {
    const { type, order } = body;
    if (!type || !Array.isArray(order)) {
        return { success: false, message: 'type and order (array of ids) are required.' };
    }
    return model.reorder({ type, order });
};

const updateBanner = async (id, body) => {
    const { routeTo, minPrice, maxPrice, category, offer } = body;
    return model.updateById(id, { routeTo, minPrice, maxPrice, category, offer });
};

module.exports = {
    createBanner,
    getActiveForFrontend,
    getAllBanners,
    deleteBanner,
    updateBanner,
    reorderBanners
};
