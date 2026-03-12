/**
 * Diagnostic + backfill helper for settlement-related data issues.
 *
 * IMPORTANT:
 * - This script must NOT execute any mutations against production.
 * - It only prints SQL statements for a DBA to review and run manually.
 */

function main() {
  const statements = [
    `-- 1. Check for delivered items with no brand
SELECT COUNT(*) AS delivered_no_brand
FROM order_items
WHERE itemStatus = 'delivered' AND brandID IS NULL;`,
    `-- 2. Check for delivered items stuck in limbo (both NULL)
SELECT oi.id, oi.orderID, oi.brandID, oi.lineTotalAfter
FROM order_items oi
JOIN orderDetail od ON oi.orderID = od.orderID
WHERE oi.itemStatus = 'delivered'
  AND oi.coinLockUntil IS NULL
  AND od.deliveredAt IS NULL;`,
    `-- 3. Check for orderDetail marked Delivered but no deliveredAt
SELECT orderID, orderStatus, deliveredAt
FROM orderDetail
WHERE LOWER(orderStatus) = 'delivered' AND deliveredAt IS NULL;`,
    `-- 4. Normalize orderStatus casing (DBA to review before running)
-- UPDATE orderDetail SET orderStatus = LOWER(orderStatus) WHERE orderStatus != LOWER(orderStatus);`,
    `-- 5. Check for negative lineTotalAfter
SELECT id, orderID, brandID, lineTotalAfter
FROM order_items
WHERE lineTotalAfter < 0;`,
    `-- 6. Distinct status values (compare against expected enums)
SELECT DISTINCT returnStatus FROM order_items;
SELECT DISTINCT itemStatus FROM order_items;
SELECT DISTINCT paymentMode FROM orderDetail;
SELECT DISTINCT orderStatus FROM orderDetail;`,
    `-- 7. Find carried_forward items (after settlement goes live)
SELECT COUNT(*), brandID
FROM order_items
WHERE settlementStatus = 'carried_forward'
GROUP BY brandID;`,
  ];

  console.log('--- Settlement diagnostics & backfill SQL (for DBA review only) ---\n');
  for (const stmt of statements) {
    console.log(`${stmt}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

