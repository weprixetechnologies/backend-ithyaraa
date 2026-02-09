const notificationService = require('../services/notificationService');

const createNotification = async (req, res) => {
  try {
    const { title, content_html, image_url, type, brandIds } = req.body || {};
    const created_by = req.user?.uid || req.user?.id || null;

    const notification = await notificationService.createNotificationForBrands({
      title,
      content_html,
      image_url,
      type,
      brandIds,
      created_by
    });

    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

const listNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await notificationService.adminListNotifications({ page, limit });
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

const getNotificationDeliveries = async (req, res) => {
  try {
    const { id } = req.params;
    const notificationId = Number(id);
    if (!Number.isInteger(notificationId) || notificationId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }
    const result = await notificationService.adminGetNotificationDeliveries({
      notificationId
    });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

const resendNotificationEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const notificationId = Number(id);
    if (!Number.isInteger(notificationId) || notificationId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }
    const { brandIds } = req.body || {};
    const result = await notificationService.adminResendNotificationEmails({
      notificationId,
      brandIds: Array.isArray(brandIds) ? brandIds : undefined
    });
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createNotification,
  listNotifications,
  getNotificationDeliveries,
  resendNotificationEmail
};

