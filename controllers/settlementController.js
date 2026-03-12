const db = require('../utils/dbconnect');
const { computeSettlement } = require('../services/settlementService');
const {
  fetchLockedSettlement,
  fetchPaymentHistory,
  insertLockedSettlement,
  markItemsIncluded,
  markItemsCarriedForward,
  insertPaymentRecord,
  updateSettlementPayment,
} = require('../models/settlementModel');

async function getSettlementDetail(req, res) {
  const { brandID, month } = req.params;
  if (!brandID || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ success: false, message: 'Invalid brandID or month format (YYYY-MM)' });
  }
  try {
    const locked = await fetchLockedSettlement(brandID, month);
    if (locked) {
      const payments = await fetchPaymentHistory(locked.id);
      return res.json({ success: true, isLocked: true, settlement: locked, payments });
    }
    const preview = await computeSettlement(brandID, month);
    return res.json({ success: true, isLocked: false, preview });
  } catch (err) {
    console.error('[getSettlementDetail]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function lockSettlement(req, res) {
  const { brandID, month } = req.params;
  const adminID = req.admin?.uid || req.user?.uid || req.body.adminID;
  if (!brandID || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ success: false, message: 'Invalid brandID or month' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(
      `SELECT id, status FROM brand_settlements WHERE brandID = ? AND settlementMonth = ? LIMIT 1`,
      [brandID, month]
    );
    if (existing.length && existing[0].status !== 'draft') {
      await conn.rollback();
      const locked = await fetchLockedSettlement(brandID, month);
      const payments = await fetchPaymentHistory(locked.id);
      return res.json({ success: true, isLocked: true, settlement: locked, payments, alreadyExists: true });
    }
    const preview = await computeSettlement(brandID, month);
    const settlementID = await insertLockedSettlement(conn, {
      brandID,
      settlementMonth: month,
      periodStart: preview.periodStart,
      periodEnd: preview.periodEnd,
      grossAmount: preview.grossAmount,
      commissionPercentage: preview.commissionPercentage,
      commissionAmount: preview.commissionAmount,
      netAmount: preview.netAmount,
      carriedForwardAmount: preview.carriedForwardAmount,
      holdReleasedAmount: preview.holdReleasedAmount,
      totalPayable: preview.totalPayable,
      itemCount: preview.itemCount,
      generatedBy: adminID,
    });
    await markItemsIncluded(conn, settlementID, preview.eligibleItems.map(i => i.id));
    await markItemsCarriedForward(conn, settlementID, preview.onHoldItems.map(i => i.id));
    const holdReleasedIDs = (preview.holdReleasedItems || []).map(i => i.id);
    if (holdReleasedIDs.length) {
      await conn.query(
        `UPDATE order_items SET settlementStatus='included', settlementID=? WHERE orderItemID IN (?)`,
        [settlementID, holdReleasedIDs]
      );
    }
    await conn.commit();
    const locked = await fetchLockedSettlement(brandID, month);
    const payments = await fetchPaymentHistory(locked.id);
    return res.json({ success: true, isLocked: true, settlement: locked, payments });
  } catch (err) {
    await conn.rollback();
    console.error('[lockSettlement]', err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
}

async function recordPayment(req, res) {
  const { id } = req.params;
  const { amount, paymentMode, utrReference, paymentDate, remarks } = req.body;
  const adminID = req.admin?.uid || req.user?.uid;
  if (!amount || isNaN(amount) || Number(amount) <= 0)
    return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
  if (!paymentMode)
    return res.status(400).json({ success: false, message: 'Payment mode is required' });
  if (['bank_transfer', 'upi'].includes(paymentMode) && !utrReference)
    return res.status(400).json({ success: false, message: 'UTR/Reference number required for this payment mode' });
  if (!paymentDate)
    return res.status(400).json({ success: false, message: 'Payment date is required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[settlement]] = await conn.query(
      `SELECT id, brandID, settlementMonth, totalPayable, amountPaid, balanceDue, status
       FROM brand_settlements WHERE id = ? FOR UPDATE`,
      [id]
    );
    if (!settlement) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }
    if (settlement.status === 'paid') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Settlement is already fully paid' });
    }
    const payAmt = Math.round(Number(amount) * 100) / 100;
    const balanceDue = Math.round(Number(settlement.balanceDue) * 100) / 100;
    if (payAmt > balanceDue) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `Amount exceeds balance due of ₹${balanceDue}` });
    }
    await insertPaymentRecord(conn, {
      settlementID: id, amount: payAmt, paymentMode,
      utrReference, paymentDate, remarks, recordedBy: adminID,
    });
    const newAmountPaid = Math.round((Number(settlement.amountPaid) + payAmt) * 100) / 100;
    const newBalanceDue = Math.round((Number(settlement.totalPayable) - newAmountPaid) * 100) / 100;
    const newStatus = newBalanceDue <= 0 ? 'paid' : 'partially_paid';
    await updateSettlementPayment(conn, id, newAmountPaid, newBalanceDue, newStatus, adminID);
    await conn.commit();
    const locked = await fetchLockedSettlement(settlement.brandID, settlement.settlementMonth);
    const payments = await fetchPaymentHistory(id);
    return res.json({ success: true, settlement: locked, payments, newAmountPaid, newBalanceDue, newStatus });
  } catch (err) {
    await conn.rollback();
    console.error('[recordPayment]', err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
}

async function getPaymentHistory(req, res) {
  const { id } = req.params;
  try {
    const payments = await fetchPaymentHistory(id);
    return res.json({ success: true, payments });
  } catch (err) {
    console.error('[getPaymentHistory]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getBrandsOverview(req, res) {
  const { month } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month))
    return res.status(400).json({ success: false, message: 'month param required (YYYY-MM)' });
  try {
    const [brands] = await db.query(
      `SELECT uid AS brandID, name AS brandName, username AS brandUsername
       FROM users WHERE role = 'brand' ORDER BY name ASC`
    );
    const [settlements] = await db.query(
      `SELECT * FROM brand_settlements WHERE settlementMonth = ?`, [month]
    );
    const settlementMap = new Map(settlements.map(s => [s.brandID, s]));
    const overview = brands.map(brand => {
      const s = settlementMap.get(brand.brandID);
      if (s) return { ...brand, ...s, settlementMonth: month };
      return {
        ...brand,
        settlementMonth: month,
        grossAmount: null, commissionAmount: null, netAmount: null,
        carriedForwardAmount: null, holdReleasedAmount: null,
        totalPayable: null, amountPaid: null, balanceDue: null,
        status: 'not_generated',
      };
    });
    return res.json({ success: true, data: overview });
  } catch (err) {
    console.error('[getBrandsOverview]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function listSettlements(req, res) {
  const { month, brandID, status } = req.query;
  const where = [], params = [];
  if (month) { where.push('bs.settlementMonth = ?'); params.push(month); }
  if (brandID) { where.push('bs.brandID = ?'); params.push(brandID); }
  if (status && status !== 'all') { where.push('bs.status = ?'); params.push(status); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const [rows] = await db.query(
      `SELECT bs.*, u.name AS brandName, u.username AS brandUsername
       FROM brand_settlements bs
       LEFT JOIN users u ON u.uid = bs.brandID
       ${whereClause}
       ORDER BY bs.periodStart DESC, bs.brandID ASC`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[listSettlements]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getSettlementDetail,
  lockSettlement,
  recordPayment,
  getPaymentHistory,
  getBrandsOverview,
  listSettlements,
};

