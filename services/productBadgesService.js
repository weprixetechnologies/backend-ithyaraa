const productBadgesModel = require('../model/productBadgesModel');

const getAllBadges = async () => {
    return await productBadgesModel.getAllBadges();
};

const getBadgeById = async (id) => {
    return await productBadgesModel.getBadgeById(id);
};

const createBadge = async (badgeData) => {
    if (!badgeData.name || !badgeData.name.trim()) {
        throw new Error('Badge name is required');
    }
    const insertId = await productBadgesModel.createBadge(badgeData);
    return await productBadgesModel.getBadgeById(insertId);
};

const updateBadge = async (id, badgeData) => {
    const existing = await productBadgesModel.getBadgeById(id);
    if (!existing) {
        throw new Error('Badge not found');
    }
    if (!badgeData.name || !badgeData.name.trim()) {
        throw new Error('Badge name is required');
    }
    await productBadgesModel.updateBadge(id, badgeData);
    return await productBadgesModel.getBadgeById(id);
};

const deleteBadge = async (id) => {
    const existing = await productBadgesModel.getBadgeById(id);
    if (!existing) {
        throw new Error('Badge not found');
    }
    return await productBadgesModel.deleteBadge(id);
};

const getBadgeProducts = async (badgeID) => {
    return await productBadgesModel.getBadgeProducts(badgeID);
};

const syncBadgeProducts = async (badgeID, productIDs) => {
    const existing = await productBadgesModel.getBadgeById(badgeID);
    if (!existing) {
        throw new Error('Badge not found');
    }
    await productBadgesModel.syncBadgeProducts(badgeID, productIDs);
    return await productBadgesModel.getBadgeProducts(badgeID);
};

const getActiveProductBadges = async () => {
    return await productBadgesModel.getActiveProductBadges();
};

module.exports = {
    getAllBadges,
    getBadgeById,
    createBadge,
    updateBadge,
    deleteBadge,
    getBadgeProducts,
    syncBadgeProducts,
    getActiveProductBadges
};
