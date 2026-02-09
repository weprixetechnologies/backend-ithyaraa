const notificationModel = require('../model/notificationModel');
const brandAuthModel = require('../model/brandAuthModel');
const { addSendEmailJob } = require('../queue/emailProducer');

function sanitizeHtmlServer(html) {
  if (!html || typeof html !== 'string') return '';
  let safe = html;
  safe = safe.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  safe = safe.replace(/\son\w+="[^"]*"/gi, '');
  safe = safe.replace(/\son\w+='[^']*'/gi, '');
  return safe;
}

async function createNotificationForBrands({ title, content_html, image_url, type, brandIds, created_by }) {
  if (!title || !content_html || !Array.isArray(brandIds) || brandIds.length === 0) {
    const err = new Error('Title, content_html and at least one brand are required');
    err.statusCode = 400;
    throw err;
  }

  const normalizedType = ['offer', 'deal', 'participation', 'general'].includes(type)
    ? type
    : 'general';

  const safeHtml = sanitizeHtmlServer(content_html);

  const notificationId = await notificationModel.createNotification({
    title: title.trim(),
    content_html: safeHtml,
    image_url: image_url || null,
    type: normalizedType,
    created_by: created_by || null
  });

  const brandNotificationRows = await notificationModel.insertBrandNotifications(notificationId, brandIds);
  const brandIdToBnId = {};
  for (const row of brandNotificationRows || []) {
    const key = row.brand_id != null ? String(row.brand_id) : '';
    if (key) brandIdToBnId[key] = row.id;
  }

  // Fetch brand users to get emails and send ONE new notification email per brand
  const brandUsers = [];
  for (const brandId of brandIds) {
    const user = await brandAuthModel.findBrandUserByUID(brandId);
    if (user && user.emailID) {
      brandUsers.push({
        uid: user.uid,
        emailID: user.emailID,
        name: user.name || user.username || ''
      });
    }
  }

  // Enqueue one plain-text "new notification" email per included brand (no batching)
  for (const brand of brandUsers) {
    await addSendEmailJob({
      to: brand.emailID,
      templateName: 'brand_notification_plain',
      variables: {
        name: brand.name || brand.emailID,
        messageLine1: 'You have one new notification in your brand dashboard.',
        messageLine2: 'Please log in to your brand panel to view it.'
      },
      subject: 'New notification available',
      brandNotificationId: (brand.uid != null && brandIdToBnId[String(brand.uid)]) ? brandIdToBnId[String(brand.uid)] : null,
      notificationId,
      brandId: brand.uid
    });
  }

  const notification = await notificationModel.getNotificationById(notificationId);
  return notification;
}

async function adminListNotifications({ page = 1, limit = 20 }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  const result = await notificationModel.listNotifications({ limit: limitNum, offset });
  return {
    data: result.data,
    total: result.total,
    page: pageNum,
    limit: limitNum
  };
}

async function adminGetNotificationDeliveries({ notificationId }) {
  const notification = await notificationModel.getNotificationById(notificationId);
  if (!notification) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }
  const deliveries = await notificationModel.getNotificationDeliveries(notificationId);
  return { notification, deliveries };
}

async function brandListNotifications({ brandId, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;
  const result = await notificationModel.listBrandNotificationsForBrand({
    brandId,
    limit: limitNum,
    offset
  });
  return {
    data: result.data,
    total: result.total,
    page: pageNum,
    limit: limitNum
  };
}

async function brandGetNotificationDetail({ brandId, notificationId }) {
  const detail = await notificationModel.getBrandNotificationDetail({ brandId, notificationId });
  if (!detail) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }
  // Mark as read when opened
  await notificationModel.markBrandNotificationRead({ brandId, notificationId });
  return detail;
}

async function brandGetUnreadCount({ brandId }) {
  const unread = await notificationModel.countUnreadForBrand(brandId);
  return { unread };
}

async function adminResendNotificationEmails({ notificationId, brandIds }) {
  const notification = await notificationModel.getNotificationById(notificationId);
  if (!notification) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }
  let deliveries = await notificationModel.getNotificationDeliveries(notificationId);
  if (Array.isArray(brandIds) && brandIds.length > 0) {
    const set = new Set(brandIds);
    deliveries = deliveries.filter((d) => set.has(d.brand_id));
  }
  if (deliveries.length === 0) {
    const err = new Error('No brands selected or no deliveries found');
    err.statusCode = 400;
    throw err;
  }
  for (const d of deliveries) {
    if (!d.emailID) continue;
    await notificationModel.updateBrandNotificationEmailStatus({
      brandNotificationId: d.brand_notification_id,
      status: 'pending'
    });
    await addSendEmailJob({
      to: d.emailID,
      templateName: 'brand_notification_plain',
      variables: {
        name: d.name || d.username || d.emailID,
        messageLine1: 'You have one new notification in your brand dashboard.',
        messageLine2: 'Please log in to your brand panel to view it.'
      },
      subject: 'New notification available',
      brandNotificationId: d.brand_notification_id,
      notificationId,
      brandId: d.brand_id
    });
  }
  return { resent: deliveries.length };
}

module.exports = {
  createNotificationForBrands,
  adminListNotifications,
  adminGetNotificationDeliveries,
  adminResendNotificationEmails,
  brandListNotifications,
  brandGetNotificationDetail,
  brandGetUnreadCount
};

