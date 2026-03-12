const {
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
} = require('../models/settlementModel');

function segregateItems(rawItems, replacementMap, cutoff) {
  const replacementOrderIDs = new Set(
    rawItems
      .filter(i => i.replacementOrderID)
      .map(i => i.replacementOrderID)
  );

  const eligibleItems = [];
  const onHoldItems = [];
  const deductedItems = [];

  for (const item of rawItems) {
    if (!item.replacementOrderID && replacementOrderIDs.has(item.orderID)) {
      continue;
    }

    const returnStatus  = String(item.returnStatus  || '').toLowerCase();
    const itemStatus    = String(item.itemStatus    || '').toLowerCase();
    const paymentMode   = String(item.paymentMode   || '').toLowerCase();
    const paymentStatus = String(item.paymentStatus || '').toLowerCase();

    const isDelivered    = itemStatus === 'delivered';
    const isCodUnpaid    = paymentMode === 'cod' && !['successful', 'paid'].includes(paymentStatus);
    const isActiveReturn = ACTIVE_RETURN_STATUSES.has(returnStatus);
    const isFinalRefund  = FINAL_REFUND_STATUSES.has(returnStatus);

    const hasReplacement = !!item.replacementOrderID;
    let combinedLineTotal = Number(item.lineTotalAfter || 0);
    let windowRef = item;

    if (hasReplacement) {
      const replacementItems = replacementMap.get(item.replacementOrderID) || [];
      for (const rep of replacementItems) {
        combinedLineTotal += Number(rep.lineTotalAfter || 0);
      }
      if (replacementItems.length > 0) {
        windowRef = replacementItems[0];
      }
    }

    const windowClosed = isDelivered && returnWindowClosed(
      windowRef.coinLockUntil,
      windowRef.deliveredAt,
      cutoff
    );

    const row = { ...item, lineTotalAfter: combinedLineTotal, hasReplacement, windowClosed };

    if (isFinalRefund && !hasReplacement) {
      deductedItems.push({ ...row, bucket: 'deducted' });
      continue;
    }

    if (!isDelivered || !windowClosed || isCodUnpaid || isActiveReturn) {
      onHoldItems.push({ ...row, bucket: 'onHold' });
      continue;
    }

    eligibleItems.push({ ...row, bucket: 'eligible' });
  }

  return { eligibleItems, onHoldItems, deductedItems };
}

async function computeSettlement(brandID, settlementMonth) {
  const { periodStart, periodEnd } = getPeriodBounds(settlementMonth);
  const isCurrent = isCurrentMonth(settlementMonth);
  const cutoff = isCurrent ? new Date() : periodEnd;

  const rawItems = await fetchRawItems(brandID, periodStart, periodEnd);

  const replacementOrderIDs = rawItems
    .filter(i => i.replacementOrderID)
    .map(i => i.replacementOrderID);

  const replacementRows = await fetchReplacementItems(replacementOrderIDs);

  const replacementMap = new Map();
  for (const rep of replacementRows) {
    if (!replacementMap.has(rep.orderID)) replacementMap.set(rep.orderID, []);
    replacementMap.get(rep.orderID).push(rep);
  }

  const { eligibleItems, onHoldItems, deductedItems } = segregateItems(
    rawItems, replacementMap, cutoff
  );

  const prevSettlement = await fetchPreviousSettlement(brandID, settlementMonth);
  let carriedForwardAmount = 0;
  let holdReleasedAmount = 0;
  const holdReleasedItems = [];

  if (prevSettlement) {
    carriedForwardAmount = Number(prevSettlement.balanceDue || 0);

    const cfItems = await fetchCarriedForwardItems(brandID, prevSettlement.id);

    const cfReplacementIDs = cfItems
      .filter(i => i.replacementOrderID)
      .map(i => i.replacementOrderID);
    const cfRepRows = await fetchReplacementItems(cfReplacementIDs);
    const cfRepMap = new Map();
    for (const rep of cfRepRows) {
      if (!cfRepMap.has(rep.orderID)) cfRepMap.set(rep.orderID, []);
      cfRepMap.get(rep.orderID).push(rep);
    }

    for (const item of cfItems) {
      const hasReplacement = !!item.replacementOrderID;
      let combinedLineTotal = Number(item.lineTotalAfter || 0);
      let windowRef = item;

      if (hasReplacement) {
        const reps = cfRepMap.get(item.replacementOrderID) || [];
        for (const rep of reps) combinedLineTotal += Number(rep.lineTotalAfter || 0);
        if (reps.length > 0) windowRef = reps[0];
      }

      const closed = returnWindowClosed(
        windowRef.coinLockUntil,
        windowRef.deliveredAt,
        cutoff
      );

      if (closed) {
        holdReleasedAmount += combinedLineTotal;
        holdReleasedItems.push({
          ...item,
          lineTotalAfter: combinedLineTotal,
          hasReplacement,
          bucket: 'holdReleased',
        });
      }
    }
  }

  const commissionPercentage = await fetchCommissionPercentage(brandID);
  const grossAmount      = Math.round(eligibleItems.reduce((s, i) => s + Number(i.lineTotalAfter || 0), 0) * 100) / 100;
  const commissionAmount = Math.round(grossAmount * (commissionPercentage / 100) * 100) / 100;
  const netAmount        = Math.round((grossAmount - commissionAmount) * 100) / 100;
  const totalPayable     = Math.round((netAmount + carriedForwardAmount + holdReleasedAmount) * 100) / 100;

  return {
    brandID,
    settlementMonth,
    periodStart: periodStart.toISOString().split('T')[0],
    periodEnd: periodEnd.toISOString().split('T')[0],
    cutoffUsed: cutoff.toISOString(),
    grossAmount,
    commissionPercentage,
    commissionAmount,
    netAmount,
    carriedForwardAmount,
    holdReleasedAmount,
    holdReleasedItems,
    totalPayable,
    amountPaid: 0,
    balanceDue: totalPayable,
    itemCount: eligibleItems.length,
    eligibleItems,
    onHoldItems,
    deductedItems,
    previousSettlement: prevSettlement
      ? {
          id: prevSettlement.id,
          month: prevSettlement.settlementMonth,
          balanceDue: prevSettlement.balanceDue,
          status: prevSettlement.status,
        }
      : null,
  };
}

module.exports = { computeSettlement, segregateItems };


