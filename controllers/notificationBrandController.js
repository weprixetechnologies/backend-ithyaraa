const notificationService = require('../services/notificationService');

const listNotificationsForBrand = async (req, res) => {
  try {
    const brandId = req.user?.uid;
    if (!brandId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { page = 1, limit = 20 } = req.query;
    const result = await notificationService.brandListNotifications({
      brandId,
      page,
      limit
    });
    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getNotificationDetailForBrand = async (req, res) => {
  try {
    const brandId = req.user?.uid;
    if (!brandId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { id } = req.params;
    const detail = await notificationService.brandGetNotificationDetail({
      brandId,
      notificationId: Number(id)
    });
    res.status(200).json({
      success: true,
      data: detail
    });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

const getUnreadCountForBrand = async (req, res) => {
  try {
    const brandId = req.user?.uid;
    if (!brandId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const result = await notificationService.brandGetUnreadCount({ brandId });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  listNotificationsForBrand,
  getNotificationDetailForBrand,
  getUnreadCountForBrand
};

