const db = require('../utils/dbconnect');

const RETURN_WINDOW_DAYS = 7;

function getPeriodBounds(settlementMonth) {
  const [year, month] = settlementMonth.split('-').map(Number);
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);
  return { periodStart, periodEnd };
}

function isCurrentMonth(settlementMonth) {
  const now = new Date();
  const [year, month] = settlementMonth.split('-').map(Number);
  return now.getFullYear() === year && now.getMonth() + 1 === month;
}

function returnWindowClosed(coinLockUntil, deliveredAt, cutoff) {
  if (coinLockUntil) {
    return new Date(coinLockUntil) < cutoff;
  }
  if (deliveredAt) {
    const windowEnd = new Date(deliveredAt);
    windowEnd.setDate(windowEnd.getDate() + RETURN_WINDOW_DAYS);
    return windowEnd < cutoff;
  }
  return false;
}

const ACTIVE_RETURN_STATUSES = new Set([
  'return_requested',
  'return_initiated',
  'return_picked',
  'replacement_processing',
  'replacement_shipped',
  'refund_pending',
]);

const FINAL_REFUND_STATUSES = new Set(['returned', 'refund_completed']);

async function fetchRawItems(brandID, periodStart, periodEnd) {
  const [rows] = await db.query(
    `SELECT
       oi.orderItemID        AS id,
       oi.orderID,
       oi.brandID,
       oi.productID,
       oi.name               AS productName,
       oi.quantity,
       oi.lineTotalAfter,
       oi.coinLockUntil,
       oi.itemStatus,
       oi.returnStatus,
       oi.settlementStatus,
       oi.replacementOrderID,
       oi.wasCarriedForward,
       oi.settlementID,
       oi.createdAt          AS itemCreatedAt,
       od.deliveredAt,
       od.orderStatus,
       od.paymentMode,
       od.paymentStatus,
       od.isReplacement
     FROM order_items oi
     INNER JOIN orderDetail od ON od.orderID = oi.orderID
     WHERE oi.brandID = ?
       AND oi.createdAt >= ?
       AND oi.createdAt <= ?
       AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')`,
    [brandID, periodStart, periodEnd]
  );
  return rows;
}

async function fetchReplacementItems(replacementOrderIDs) {
  if (!replacementOrderIDs.length) return [];
  const [rows] = await db.query(
    `SELECT
       oi.orderItemID  AS id,
       oi.orderID,
       oi.lineTotalAfter,
       oi.coinLockUntil,
       oi.itemStatus,
       oi.returnStatus,
       oi.settlementStatus,
       od.deliveredAt,
       od.orderStatus,
       od.paymentMode,
       od.paymentStatus
     FROM order_items oi
     INNER JOIN orderDetail od ON od.orderID = oi.orderID
     WHERE oi.orderID IN (?)`,
    [replacementOrderIDs]
  );
  return rows;
}

async function fetchPreviousSettlement(brandID, settlementMonth) {
  const [rows] = await db.query(
    `SELECT id, settlementMonth, balanceDue, netAmount, totalPayable, status
     FROM brand_settlements
     WHERE brandID = ?
       AND settlementMonth < ?
       AND status NOT IN ('draft')
     ORDER BY settlementMonth DESC
     LIMIT 1`,
    [brandID, settlementMonth]
  );
  return rows[0] || null;
}

async function fetchCarriedForwardItems(brandID, prevSettlementID) {
  const [rows] = await db.query(
    `SELECT
       oi.orderItemID   AS id,
       oi.orderID,
       oi.lineTotalAfter,
       oi.coinLockUntil,
       oi.itemStatus,
       oi.returnStatus,
       oi.replacementOrderID,
       oi.wasCarriedForward,
       od.deliveredAt,
       od.orderStatus,
       od.paymentMode,
       od.paymentStatus
     FROM order_items oi
     INNER JOIN orderDetail od ON od.orderID = oi.orderID
     WHERE oi.brandID = ?
       AND oi.settlementStatus = 'carried_forward'
       AND oi.settlementID = ?`,
    [brandID, prevSettlementID]
  );
  return rows;
}

async function fetchCommissionPercentage(brandID) {
  const [rows] = await db.query(
    `SELECT commissionPercentage FROM users WHERE uid = ? LIMIT 1`,
    [brandID]
  );
  return rows[0]?.commissionPercentage || 0;
}

async function fetchLockedSettlement(brandID, settlementMonth) {
  const [rows] = await db.query(
    `SELECT bs.*,
            u.name AS brandName,
            u.username AS brandUsername
     FROM brand_settlements bs
     LEFT JOIN users u ON u.uid = bs.brandID
     WHERE bs.brandID = ? AND bs.settlementMonth = ?
       AND bs.status != 'draft'
     LIMIT 1`,
    [brandID, settlementMonth]
  );
  return rows[0] || null;
}

async function fetchPaymentHistory(settlementID) {
  const [rows] = await db.query(
    `SELECT sp.*, u.name AS recordedByName
     FROM settlement_payments sp
     LEFT JOIN users u ON u.uid = sp.recordedBy
     WHERE sp.settlementID = ?
     ORDER BY sp.createdAt ASC`,
    [settlementID]
  );
  return rows;
}

async function insertLockedSettlement(conn, data) {
  const {
    brandID, settlementMonth, periodStart, periodEnd,
    grossAmount, commissionPercentage, commissionAmount, netAmount,
    carriedForwardAmount, holdReleasedAmount, totalPayable,
    itemCount, generatedBy,
  } = data;

  const [existing] = await conn.query(
    `SELECT id, status FROM brand_settlements WHERE brandID = ? AND settlementMonth = ? LIMIT 1`,
    [brandID, settlementMonth]
  );

  if (existing.length && existing[0].status !== 'draft') {
    return existing[0].id;
  }

  if (existing.length && existing[0].status === 'draft') {
    await conn.query(
      `UPDATE brand_settlements SET
         periodStart=?, periodEnd=?, grossAmount=?, commissionPercentage=?,
         commissionAmount=?, netAmount=?, carriedForwardAmount=?, holdReleasedAmount=?,
         totalPayable=?, amountPaid=0, balanceDue=?, itemCount=?,
         status='pending_approval', generatedBy=?, createdAt=NOW()
       WHERE id=?`,
      [
        periodStart, periodEnd, grossAmount, commissionPercentage,
        commissionAmount, netAmount, carriedForwardAmount, holdReleasedAmount,
        totalPayable, totalPayable, itemCount, generatedBy, existing[0].id,
      ]
    );
    return existing[0].id;
  }

  const [result] = await conn.query(
    `INSERT INTO brand_settlements
       (brandID, settlementMonth, periodStart, periodEnd,
        grossAmount, commissionPercentage, commissionAmount, netAmount,
        carriedForwardAmount, holdReleasedAmount, totalPayable,
        amountPaid, balanceDue, itemCount, status, generatedBy, createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,'pending_approval',?,NOW())`,
    [
      brandID, settlementMonth, periodStart, periodEnd,
      grossAmount, commissionPercentage, commissionAmount, netAmount,
      carriedForwardAmount, holdReleasedAmount, totalPayable,
      totalPayable, itemCount, generatedBy,
    ]
  );
  return result.insertId;
}

async function markItemsIncluded(conn, settlementID, itemIDs) {
  if (!itemIDs.length) return;
  await conn.query(
    `UPDATE order_items SET settlementStatus='included', settlementID=?
     WHERE orderItemID IN (?)`,
    [settlementID, itemIDs]
  );
}

async function markItemsCarriedForward(conn, settlementID, itemIDs) {
  if (!itemIDs.length) return;
  await conn.query(
    `UPDATE order_items SET settlementStatus='carried_forward', wasCarriedForward=1, settlementID=?
     WHERE orderItemID IN (?)`,
    [settlementID, itemIDs]
  );
}

async function insertPaymentRecord(conn, { settlementID, amount, paymentMode, utrReference, paymentDate, remarks, recordedBy }) {
  await conn.query(
    `INSERT INTO settlement_payments
       (settlementID, amount, paymentMode, utrReference, paymentDate, remarks, recordedBy, createdAt)
     VALUES (?,?,?,?,?,?,?,NOW())`,
    [settlementID, amount, paymentMode, utrReference || null, paymentDate, remarks || null, recordedBy]
  );
}

async function updateSettlementPayment(conn, settlementID, newAmountPaid, newBalanceDue, newStatus, settledBy) {
  const settledAtSQL = newStatus === 'paid' ? ', settledAt=NOW(), settledBy=?' : '';
  const params = newStatus === 'paid'
    ? [newAmountPaid, newBalanceDue, newStatus, settledBy, settlementID]
    : [newAmountPaid, newBalanceDue, newStatus, settlementID];
  await conn.query(
    `UPDATE brand_settlements SET amountPaid=?, balanceDue=?, status=?${settledAtSQL} WHERE id=?`,
    params
  );
}

module.exports = {
  getPeriodBounds,
  isCurrentMonth,
  returnWindowClosed,
  ACTIVE_RETURN_STATUSES,
  FINAL_REFUND_STATUSES,
  fetchRawItems,
  fetchReplacementItems,
  fetchCarriedForwardItems,
  fetchPreviousSettlement,
  fetchCommissionPercentage,
  fetchLockedSettlement,
  fetchPaymentHistory,
  insertLockedSettlement,
  markItemsIncluded,
  markItemsCarriedForward,
  insertPaymentRecord,
  updateSettlementPayment,
};

