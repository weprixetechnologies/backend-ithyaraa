const db = require('../utils/dbconnect');

// Core notification CRUD

async function createNotification({ title, content_html, image_url, type, created_by }) {
  const [result] = await db.query(
    `INSERT INTO notifications (title, content_html, image_url, type, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [title, content_html, image_url || null, type || 'general', created_by || null]
  );
  return result.insertId;
}

async function getNotificationById(id) {
  const [rows] = await db.query(
    `SELECT id, title, content_html, image_url, type, created_by, created_at
     FROM notifications
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listNotifications({ limit = 20, offset = 0 }) {
  const [rows] = await db.query(
    `SELECT n.id,
            n.title,
            n.type,
            n.created_by,
            n.created_at,
            COUNT(bn.id) AS total_brands,
            SUM(CASE WHEN bn.is_read = 1 THEN 1 ELSE 0 END) AS read_count
     FROM notifications n
     LEFT JOIN brand_notifications bn ON bn.notification_id = n.id
     GROUP BY n.id
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT ? OFFSET ?`,
    [Number(limit), Number(offset)]
  );

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM notifications`
  );

  return {
    data: rows,
    total: countRow?.total || 0
  };
}

// Brand-specific notification relations

async function insertBrandNotifications(notificationId, brandIds = []) {
  if (!notificationId || !Array.isArray(brandIds) || brandIds.length === 0) {
    return [];
  }
  const values = brandIds.map((brandId) => [notificationId, brandId]);
  await db.query(
    `INSERT INTO brand_notifications (notification_id, brand_id)
     VALUES ?`,
    [values]
  );
  // Return id and brand_id for each row so we can pass brandNotificationId to email jobs
  const [rows] = await db.query(
    `SELECT id, brand_id FROM brand_notifications
     WHERE notification_id = ?
     ORDER BY id ASC`,
    [notificationId]
  );
  return rows;
}

async function listBrandNotificationsForBrand({ brandId, limit = 20, offset = 0 }) {
  const [rows] = await db.query(
    `SELECT 
        bn.id AS brand_notification_id,
        n.id AS notification_id,
        n.title,
        n.type,
        n.created_at,
        bn.is_read,
        bn.read_at
     FROM brand_notifications bn
     INNER JOIN notifications n ON n.id = bn.notification_id
     WHERE bn.brand_id = ?
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT ? OFFSET ?`,
    [brandId, Number(limit), Number(offset)]
  );

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM brand_notifications
     WHERE brand_id = ?`,
    [brandId]
  );

  return {
    data: rows,
    total: countRow?.total || 0
  };
}

async function getBrandNotificationDetail({ notificationId, brandId }) {
  const [rows] = await db.query(
    `SELECT 
        bn.id AS brand_notification_id,
        bn.brand_id,
        bn.is_read,
        bn.read_at,
        bn.email_status,
        bn.email_sent_at,
        n.id AS notification_id,
        n.title,
        n.content_html,
        n.image_url,
        n.type,
        n.created_by,
        n.created_at
     FROM brand_notifications bn
     INNER JOIN notifications n ON n.id = bn.notification_id
     WHERE bn.brand_id = ? AND bn.notification_id = ?
     LIMIT 1`,
    [brandId, notificationId]
  );
  return rows[0] || null;
}

async function markBrandNotificationRead({ notificationId, brandId }) {
  const [result] = await db.query(
    `UPDATE brand_notifications
     SET is_read = 1,
         read_at = CASE WHEN read_at IS NULL THEN NOW() ELSE read_at END
     WHERE notification_id = ? AND brand_id = ?`,
    [notificationId, brandId]
  );
  return result.affectedRows;
}

async function getNotificationDeliveries(notificationId) {
  const [rows] = await db.query(
    `SELECT 
        bn.id AS brand_notification_id,
        bn.brand_id,
        bn.is_read,
        bn.read_at,
        bn.email_status,
        bn.email_sent_at,
        u.username,
        u.name,
        u.emailID
     FROM brand_notifications bn
     LEFT JOIN users u ON u.uid = bn.brand_id
     WHERE bn.notification_id = ?
     ORDER BY u.name ASC, u.username ASC`,
    [notificationId]
  );
  return rows;
}

async function updateBrandNotificationEmailStatus({ brandNotificationId, status }) {
  if (!brandNotificationId || !status) return;
  await db.query(
    `UPDATE brand_notifications
     SET email_status = ?,
         email_sent_at = CASE WHEN ? = 'sent' THEN NOW() ELSE email_sent_at END
     WHERE id = ?`,
    [status, status, brandNotificationId]
  );
}

async function countUnreadForBrand(brandId) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS unread
     FROM brand_notifications
     WHERE brand_id = ? AND is_read = 0`,
    [brandId]
  );
  return row?.unread || 0;
}

module.exports = {
  createNotification,
  getNotificationById,
  listNotifications,
  insertBrandNotifications,
  listBrandNotificationsForBrand,
  getBrandNotificationDetail,
  markBrandNotificationRead,
  getNotificationDeliveries,
  updateBrandNotificationEmailStatus,
  countUnreadForBrand
};

