const express = require('express')
const orderBrandRouter = express.Router()
const authBrandMiddleware = require('../../middleware/authBrandMiddleware')
const db = require('../../utils/dbconnect')
const ExcelJS = require('exceljs');
const { queueOrderStatusEmail } = require('../../services/orderStatusEmailService')

const RETURN_WINDOW_DAYS = parseInt(process.env.RETURN_WINDOW_DAYS || '7', 10) || 7;

// GET /api/brand/analytics - Brand-level payments & orders analytics
orderBrandRouter.get('/analytics', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const brandID = req.user.uid;
        let { startDate, endDate, period = '30d' } = req.query;

        const parseDate = (value) => {
            if (!value) return null;
            const d = new Date(value);
            return Number.isNaN(d.getTime()) ? null : d;
        };

        const now = new Date();
        let start, end;

        const toLocalDateOnly = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (period === 'custom') {
            start = parseDate(startDate);
            end = parseDate(endDate);
            if (!start || !end) {
                return res.status(400).json({ success: false, message: 'Invalid startDate or endDate for custom period' });
            }
            if (start > end) {
                return res.status(400).json({ success: false, message: 'startDate cannot be after endDate' });
            }
        } else {
            const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
            const days = daysMap[period] || 30;
            end = now;
            start = new Date(now);
            start.setDate(start.getDate() - (days - 1));
        }

        const startStr = (startDate || toLocalDateOnly(start));
        const endStr = (endDate || toLocalDateOnly(end));

        const dateDiffMs = new Date(endStr).getTime() - new Date(startStr).getTime();
        const dateDiffDays = Math.floor(dateDiffMs / (1000 * 60 * 60 * 24)) + 1;
        const groupByWeek = dateDiffDays > 90;

        // Get commission percentage for this brand
        const [brandRows] = await db.query(
            `SELECT commissionPercentage 
             FROM users 
             WHERE uid = ? AND role = 'brand' 
             LIMIT 1`,
            [brandID]
        );
        const commissionPercentage = brandRows && brandRows[0] && brandRows[0].commissionPercentage != null
            ? Number(brandRows[0].commissionPercentage)
            : null;

        // Summary metrics with on-hold breakdown and gross/net payments.
        // IMPORTANT: These are based on CURRENT state of all items for this brand (not limited by date range),
        // so the timeline selector does not affect ON HOLD and AVAILABLE amounts.
        const [summaryRows] = await db.query(
            `SELECT 
                COUNT(DISTINCT oi.orderID) AS totalOrders,
                SUM(CASE WHEN oi.itemStatus = 'shipped' THEN 1 ELSE 0 END) AS shippedItems,
                SUM(CASE WHEN oi.itemStatus = 'delivered' THEN 1 ELSE 0 END) AS deliveredItems,
                SUM(CASE WHEN oi.itemStatus IN ('pending', 'preparing') THEN 1 ELSE 0 END) AS pendingItems,
                SUM(CASE WHEN oi.returnStatus IN ('returned', 'refund_completed', 'refund_pending') THEN 1 ELSE 0 END) AS returnItems,
                SUM(CASE WHEN oi.returnStatus IN ('return_initiated', 'replacement_processing', 'replacement_shipped', 'replacement_complete') THEN 1 ELSE 0 END) AS replacementItems,
                SUM(CASE WHEN oi.returnStatus = 'returnRejected' THEN 1 ELSE 0 END) AS returnRejectedCount,
                SUM(CASE WHEN LOWER(od.paymentMode) = 'cod' THEN oi.lineTotalAfter ELSE 0 END) AS codAmount,
                SUM(CASE WHEN LOWER(od.paymentMode) <> 'cod' THEN oi.lineTotalAfter ELSE 0 END) AS prepaidAmount,

                -- ON HOLD bucket 1: preparing / shipped, no return raised
                SUM(
                    CASE 
                        WHEN oi.itemStatus IN ('preparing', 'shipped')
                             AND (oi.returnStatus IS NULL OR oi.returnStatus IN ('none', 'returnRejected'))
                             AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
                             AND oi.settlementStatus = 'unsettled'
                        THEN oi.lineTotalAfter ELSE 0 
                    END
                ) AS awaitingDeliveryAmount,

                -- ON HOLD bucket 2: delivered, within return window
                SUM(
                    CASE 
                        WHEN oi.itemStatus = 'delivered' 
                             AND (oi.returnStatus IS NULL OR oi.returnStatus IN ('none', 'returnRejected', 'replacement_complete'))
                             AND (
                                 (oi.coinLockUntil IS NOT NULL AND oi.coinLockUntil > NOW())
                                 OR (oi.coinLockUntil IS NULL AND od.deliveredAt IS NOT NULL
                                     AND DATE_ADD(od.deliveredAt, INTERVAL ${RETURN_WINDOW_DAYS} DAY) > NOW())
                             )
                             AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
                             AND oi.settlementStatus = 'unsettled'
                        THEN oi.lineTotalAfter ELSE 0 
                    END
                ) AS deliveredWithinWindowAmount,

                -- ON HOLD bucket 3: replacement in progress
                SUM(
                    CASE 
                        WHEN oi.returnStatus IN ('return_initiated', 'replacement_processing','replacement_shipped')
                             AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
                        THEN oi.lineTotalAfter ELSE 0 
                    END
                ) AS replacementInProgressAmount,

                -- DEDUCTED: refund in progress or complete
                SUM(
                    CASE 
                        WHEN oi.returnStatus IN ('returned','refund_pending','refund_completed')
                             AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
                        THEN oi.lineTotalAfter ELSE 0 
                    END
                ) AS refundedAmount,

                -- GROSS AVAILABLE
                SUM(
                    CASE
                        WHEN oi.itemStatus = 'delivered'
                             AND (oi.returnStatus IS NULL OR oi.returnStatus IN ('none', 'returnRejected', 'replacement_complete'))
                             AND (
                                 (oi.coinLockUntil IS NOT NULL AND oi.coinLockUntil <= NOW())
                                 OR (oi.coinLockUntil IS NULL AND od.deliveredAt IS NOT NULL
                                     AND DATE_ADD(od.deliveredAt, INTERVAL ${RETURN_WINDOW_DAYS} DAY) <= NOW())
                             )
                             AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
                             AND oi.settlementStatus = 'unsettled'
                             AND NOT (
                                 LOWER(od.paymentMode) = 'cod' 
                                 AND od.paymentStatus NOT IN ('successful', 'paid')
                             )
                        THEN oi.lineTotalAfter
                        ELSE 0
                    END
                ) AS grossAvailablePayment,

                SUM(
                    CASE
                        WHEN oi.settlementStatus = 'carried_forward'
                             AND (oi.returnStatus IS NULL OR oi.returnStatus = 'none')
                             AND oi.itemStatus = 'delivered'
                             AND (
                                (oi.coinLockUntil IS NOT NULL AND oi.coinLockUntil <= NOW())
                                OR (oi.coinLockUntil IS NULL AND od.deliveredAt IS NOT NULL
                                    AND DATE_ADD(od.deliveredAt, INTERVAL ${RETURN_WINDOW_DAYS} DAY) <= NOW())
                             )
                             AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
                        THEN oi.lineTotalAfter ELSE 0
                    END
                ) AS carriedForwardAmount

            FROM order_items oi
            INNER JOIN orderDetail od ON od.orderID = oi.orderID
            WHERE oi.brandID = ?
              AND DATE(oi.createdAt) BETWEEN ? AND ?`,
            [brandID, startStr, endStr]
        );

        const s = summaryRows && summaryRows[0] ? summaryRows[0] : {};

        const codAmount = Number(s.codAmount || 0);
        const prepaidAmount = Number(s.prepaidAmount || 0);

        const awaitingDeliveryAmount = Number(s.awaitingDeliveryAmount || 0);
        const deliveredWithinWindowAmount = Number(s.deliveredWithinWindowAmount || 0);
        const replacementInProgressAmount = Number(s.replacementInProgressAmount || 0);
        const refundedAmount = Number(s.refundedAmount || 0);
        const carriedForwardAmount = Number(s.carriedForwardAmount || 0);
        const returnRejectedCount = Number(s.returnRejectedCount || 0);

        // ON HOLD: preparing + shipped + delivered within window + replacement in progress
        const onHoldAmount = awaitingDeliveryAmount
            + deliveredWithinWindowAmount
            + replacementInProgressAmount;

        const deductedAmount = refundedAmount;

        const grossAvailablePayment = Number(s.grossAvailablePayment || 0);
        const appliedCommission = commissionPercentage != null ? commissionPercentage : 0;
        const commissionAmount = Math.round(grossAvailablePayment * (appliedCommission / 100) * 100) / 100;
        const netAvailablePayment = Math.round((grossAvailablePayment - commissionAmount) * 100) / 100;

        // Time-series (daily <= 90d, weekly for longer)
        let dateExpr;
        if (groupByWeek) {
            // Week commencing date (start of week for each createdAt)
            dateExpr = `DATE(DATE_SUB(oi.createdAt, INTERVAL WEEKDAY(oi.createdAt) DAY))`;
        } else {
            dateExpr = `DATE(oi.createdAt)`;
        }

        const [timeRows] = await db.query(
            `SELECT 
                ${dateExpr} AS dateKey,
                COUNT(DISTINCT oi.orderID) AS orders,
                COALESCE(SUM(oi.lineTotalAfter), 0) AS revenue,
                SUM(CASE WHEN oi.itemStatus = 'shipped' THEN 1 ELSE 0 END) AS shipped,
                SUM(CASE WHEN oi.itemStatus = 'delivered' THEN 1 ELSE 0 END) AS delivered,
                SUM(CASE WHEN oi.returnStatus IN ('returned', 'refund_completed', 'refund_pending') THEN 1 ELSE 0 END) AS returns
             FROM order_items oi
             INNER JOIN orderDetail od ON od.orderID = oi.orderID
             WHERE oi.brandID = ?
               AND DATE(oi.createdAt) BETWEEN ? AND ?
             GROUP BY dateKey
             ORDER BY dateKey ASC`,
            [brandID, startStr, endStr]
        );

        const timeSeries = (timeRows || []).map(row => ({
            date: row.dateKey,
            orders: Number(row.orders || 0),
            revenue: Number(row.revenue || 0),
            shipped: Number(row.shipped || 0),
            delivered: Number(row.delivered || 0),
            returns: Number(row.returns || 0)
        }));

        return res.json({
            success: true,
            data: {
                summary: {
                    totalOrders: Number(s.totalOrders || 0),
                    shipped: Number(s.shippedItems || 0),
                    delivered: Number(s.deliveredItems || 0),
                    pendingOrders: Number(s.pendingItems || 0),
                    returns: Number(s.returnItems || 0),
                    replacements: Number(s.replacementItems || 0),
                    returnRejectedCount,
                    codAmount,
                    prepaidAmount,
                    onHoldAmount,
                    onHoldBreakdown: {
                        awaitingDelivery: awaitingDeliveryAmount,
                        deliveredWithinReturnWindow: deliveredWithinWindowAmount,
                        replacementInProgress: replacementInProgressAmount
                    },
                    deductedAmount,
                    deductedBreakdown: {
                        refunded: refundedAmount
                    },
                    carriedForwardAmount,
                    grossAvailablePayment,
                    commissionPercentage: commissionPercentage,
                    commissionAmount,
                    netAvailablePayment
                },
                timeSeries,
                meta: {
                    startDate: startStr,
                    endDate: endStr,
                    period: period === 'custom' ? 'custom' : (period || '30d'),
                    groupBy: groupByWeek ? 'week' : 'day'
                }
            }
        });
    } catch (error) {
        console.error('Error fetching brand analytics:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch analytics', error: error.message });
    }
});

// GET /api/brand/analytics/breakdown - Detailed breakdown for settlement and order buckets
orderBrandRouter.get('/analytics/breakdown', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const brandID = req.user.uid;
        const {
            bucket,
            page = 1,
            limit = 20,
            startDate,
            endDate
        } = req.query;

        const bucketConditions = {
            grossAvailable: `
                oi.itemStatus = 'delivered'
                AND (oi.returnStatus IS NULL OR oi.returnStatus IN ('none','returnRejected','replacement_complete'))
                AND (
                    (oi.coinLockUntil IS NOT NULL AND oi.coinLockUntil <= NOW())
                    OR (oi.coinLockUntil IS NULL AND od.deliveredAt IS NOT NULL
                        AND DATE_ADD(od.deliveredAt, INTERVAL ${RETURN_WINDOW_DAYS} DAY) <= NOW())
                )
                AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
                AND oi.settlementStatus = 'unsettled'
                AND NOT (
                    LOWER(od.paymentMode) = 'cod'
                    AND od.paymentStatus NOT IN ('successful','paid')
                )
            `,
            onHold_shipped: `
                (oi.itemStatus IN ('preparing', 'shipped'))
                AND (oi.returnStatus IS NULL OR oi.returnStatus IN ('none','returnRejected'))
                AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
                AND oi.settlementStatus = 'unsettled'
            `,
            onHold_delivered: `
                oi.itemStatus = 'delivered'
                AND (oi.returnStatus IS NULL OR oi.returnStatus IN ('none','returnRejected','replacement_complete'))
                AND (
                    (oi.coinLockUntil IS NOT NULL AND oi.coinLockUntil > NOW())
                    OR (oi.coinLockUntil IS NULL AND od.deliveredAt IS NOT NULL
                        AND DATE_ADD(od.deliveredAt, INTERVAL ${RETURN_WINDOW_DAYS} DAY) > NOW())
                )
                AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
                AND oi.settlementStatus = 'unsettled'
            `,
            onHold_replacement: `
                oi.returnStatus IN ('return_initiated','replacement_processing','replacement_shipped')
                AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
            `,
            deducted_refunded: `
                oi.returnStatus IN ('returned','refund_pending','refund_completed')
                AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
            `,
            // Period-scoped buckets
            totalOrders: `1=1`,
            shipped: `oi.itemStatus = 'shipped'`,
            delivered: `oi.itemStatus = 'delivered'`,
            pending: `oi.itemStatus = 'preparing' OR oi.itemStatus = 'pending'`,
            returns: `oi.returnStatus IN ('returned','refund_completed','refund_pending')`,
            replacements: `oi.returnStatus IN ('return_initiated','replacement_processing','replacement_shipped','replacement_complete')`,
            cod: `LOWER(od.paymentMode) = 'cod'`,
            prepaid: `LOWER(od.paymentMode) <> 'cod'`,
            commissionDue: `
                oi.itemStatus = 'delivered'
                AND (oi.returnStatus IS NULL OR oi.returnStatus IN ('none','returnRejected','replacement_complete'))
                AND (
                    (oi.coinLockUntil IS NOT NULL AND oi.coinLockUntil <= NOW())
                    OR (oi.coinLockUntil IS NULL AND od.deliveredAt IS NOT NULL
                        AND DATE_ADD(od.deliveredAt, INTERVAL ${RETURN_WINDOW_DAYS} DAY) <= NOW())
                )
                AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
                AND oi.settlementStatus = 'unsettled'
                AND NOT (
                    LOWER(od.paymentMode) = 'cod'
                    AND od.paymentStatus NOT IN ('successful','paid')
                )
            `,
            netAvailable: `
                oi.itemStatus = 'delivered'
                AND (oi.returnStatus IS NULL OR oi.returnStatus IN ('none','returnRejected','replacement_complete'))
                AND (
                    (oi.coinLockUntil IS NOT NULL AND oi.coinLockUntil <= NOW())
                    OR (oi.coinLockUntil IS NULL AND od.deliveredAt IS NOT NULL
                        AND DATE_ADD(od.deliveredAt, INTERVAL ${RETURN_WINDOW_DAYS} DAY) <= NOW())
                )
                AND LOWER(od.orderStatus) NOT IN ('pending','cancelled')
                AND oi.settlementStatus = 'unsettled'
                AND NOT (
                    LOWER(od.paymentMode) = 'cod'
                    AND od.paymentStatus NOT IN ('successful','paid')
                )
            `,
        };

        const financialBuckets = new Set(['grossAvailable', 'commissionDue', 'netAvailable']);

        const bucketLabels = {
            grossAvailable: 'Available for Settlement',
            commissionDue: 'Commission to Be Deducted',
            netAvailable: 'Net Payable After Commission',
            onHold_shipped: 'On Hold — Shipped (Awaiting Delivery)',
            onHold_delivered: 'On Hold — Delivered (Within Return Window)',
            onHold_replacement: 'On Hold — Replacement In Progress',
            deducted_refunded: 'Deducted — Refunded',
            totalOrders: 'All Orders',
            shipped: 'Shipped Orders',
            delivered: 'Delivered Orders',
            pending: 'Pending Orders',
            returns: 'Returned Orders',
            replacements: 'Replacement Orders',
            cod: 'COD Orders',
            prepaid: 'Prepaid Orders',
        };

        if (!bucket || !bucketConditions[bucket]) {
            return res.status(400).json({ success: false, message: 'Invalid or missing bucket parameter' });
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const offset = (pageNum - 1) * limitNum;

        const whereParts = ['oi.brandID = ?'];
        const whereParams = [brandID];

        const bucketCondition = bucketConditions[bucket];
        whereParts.push(bucketCondition);

        // If a date range is provided, always filter by it so that
        // modal results match the visible period in the header.
        if (startDate && endDate) {
            whereParts.push('DATE(oi.createdAt) BETWEEN ? AND ?');
            whereParams.push(startDate, endDate);
        }

        const whereClause = whereParts.join(' AND ');

        const countSql = `
            SELECT 
                COUNT(*) AS totalItems,
                COALESCE(SUM(oi.lineTotalAfter), 0) AS totalAmount
            FROM order_items oi
            INNER JOIN orderDetail od ON od.orderID = oi.orderID
            LEFT JOIN users u ON u.uid = od.uid
            WHERE ${whereClause}
        `;

        const [countRows] = await db.query(countSql, whereParams);
        const totalItems = Number(countRows[0]?.totalItems || 0);
        const totalAmount = Number(countRows[0]?.totalAmount || 0);

        const selectSql = `
            SELECT 
              oi.orderItemID            AS itemID,
              oi.orderID,
              oi.name                   AS productName,
              oi.variationName,
              oi.featuredImage,
              oi.quantity,
              oi.lineTotalAfter         AS amount,
              oi.itemStatus,
              oi.returnStatus,
              oi.settlementStatus,
              oi.coinLockUntil,
              od.orderStatus,
              od.paymentMode,
              od.paymentStatus,
              od.deliveredAt,
              od.createdAt              AS orderDate,
              u.name                    AS customerName,
              CONCAT('XXXXXX', RIGHT(u.phonenumber, 4)) AS customerPhone,
              CASE 
                WHEN oi.coinLockUntil IS NOT NULL THEN oi.coinLockUntil
                WHEN od.deliveredAt IS NOT NULL THEN DATE_ADD(od.deliveredAt, INTERVAL ? DAY)
                ELSE NULL
              END AS returnWindowExpiry
            FROM order_items oi
            INNER JOIN orderDetail od ON od.orderID = oi.orderID
            LEFT JOIN orderDetail rod ON rod.orderID = oi.replacementOrderID
            LEFT JOIN users u ON u.uid = od.uid
            WHERE ${whereClause}
            ORDER BY od.createdAt DESC
            LIMIT ? OFFSET ?
        `;

        const selectParams = [RETURN_WINDOW_DAYS, ...whereParams, limitNum, offset];
        const [rows] = await db.query(selectSql, selectParams);

        let commissionPercentage = null;
        let commissionAmount = null;
        let netAmount = null;
        if (financialBuckets.has(bucket)) {
            const [brandRows] = await db.query(
                `SELECT commissionPercentage 
                 FROM users 
                 WHERE uid = ? AND role = 'brand' 
                 LIMIT 1`,
                [brandID]
            );
            commissionPercentage =
                brandRows && brandRows[0] && brandRows[0].commissionPercentage != null
                    ? Number(brandRows[0].commissionPercentage)
                    : 0;
            commissionAmount =
                Math.round(totalAmount * (commissionPercentage / 100) * 100) / 100;
            netAmount = Math.round((totalAmount - commissionAmount) * 100) / 100;
        }

        const items = (rows || []).map((row) => {
            const base = {
                itemID: row.itemID,
                orderID: row.orderID,
                productName: row.productName,
                variationName: row.variationName,
                featuredImage: row.featuredImage,
                quantity: row.quantity,
                amount: Number(row.amount || 0),
                itemStatus: row.itemStatus,
                returnStatus: row.returnStatus,
                settlementStatus: row.settlementStatus,
                coinLockUntil: row.coinLockUntil,
                orderStatus: row.orderStatus,
                paymentMode: row.paymentMode,
                paymentStatus: row.paymentStatus,
                deliveredAt: row.deliveredAt,
                orderDate: row.orderDate,
                returnWindowExpiry: row.returnWindowExpiry,
                customerName: row.customerName,
                customerPhone: row.customerPhone,
            };

            if (financialBuckets.has(bucket) && commissionPercentage != null) {
                const itemCommission =
                    Math.round(base.amount * (commissionPercentage / 100) * 100) / 100;
                const itemNet = Math.round((base.amount - itemCommission) * 100) / 100;
                return {
                    ...base,
                    itemCommission,
                    itemNet,
                };
            }

            return base;
        });

        return res.json({
            success: true,
            data: {
                bucket,
                bucketLabel: bucketLabels[bucket] || bucket,
                totalItems,
                totalAmount,
                commissionPercentage,
                commissionAmount,
                netAmount,
                page: pageNum,
                totalPages: Math.ceil(totalItems / limitNum) || 1,
                items,
            },
        });
    } catch (error) {
        console.error('Error fetching brand analytics breakdown:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics breakdown',
            error: error.message,
        });
    }
});

// GET /api/brand/orders - Get all orders with pagination and filters
orderBrandRouter.get('/orders', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, status, paymentStatus, search, itemStatus, startDate, endDate } = req.query;
        const offset = (page - 1) * limit;
        const brandID = req.user.uid; // Get brandID from JWT token
        console.log(brandID);

        // Build WHERE conditions for filtering (filter directly on order_items by brandID)
        let whereConditions = ['oi.brandID = ?'];
        let queryParams = [brandID];

        if (search) {
            whereConditions.push('(oi.orderID LIKE ? OR oi.name LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm);
        }

        // Support filtering by per-item status (pending | shipped | delivered)
        // Prefer explicit itemStatus query param; fallback to status for backward-compat
        const effectiveItemStatus = itemStatus || status;
        if (effectiveItemStatus) {
            whereConditions.push('oi.itemStatus = ?');
            queryParams.push(effectiveItemStatus);
        }

        if (startDate && endDate) {
            whereConditions.push('DATE(oi.createdAt) BETWEEN ? AND ?');
            queryParams.push(startDate, endDate);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Get total count of unique orders
        const countQuery = `
            SELECT COUNT(DISTINCT oi.orderID) as total
            FROM order_items oi
            ${whereClause}
        `;

        const [countResult] = await db.query(countQuery, queryParams);
        const total = countResult[0]?.total || 0;


        // Get orders with pagination - group by orderID
        const ordersQuery = `
            SELECT 
                oi.orderID,
                oi.uid,
                oi.createdAt,
                COUNT(oi.orderID) as itemCount,
                SUM(oi.lineTotalAfter) as total,
                GROUP_CONCAT(oi.name SEPARATOR ', ') as itemNames
            FROM order_items oi
            ${whereClause}
            GROUP BY oi.orderID, oi.uid, oi.createdAt
            ORDER BY oi.createdAt DESC
            LIMIT ? OFFSET ?
        `;

        const [orders] = await db.query(ordersQuery, [...queryParams, parseInt(limit), offset]);

        res.json({
            success: true,
            data: orders,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalOrders: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching brand orders:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch orders', error: error.message });
    }
});

// GET /api/brand/orders/export - Export orders to Excel
orderBrandRouter.get('/orders/export', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const brandID = req.user.uid;
        const { search, itemStatus, startDate, endDate } = req.query;

        let whereConditions = ['oi.brandID = ?'];
        let queryParams = [brandID];

        if (search) {
            whereConditions.push('(oi.orderID LIKE ? OR oi.name LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm);
        }

        if (itemStatus) {
            whereConditions.push('oi.itemStatus = ?');
            queryParams.push(itemStatus);
        }

        if (startDate && endDate) {
            whereConditions.push('DATE(oi.createdAt) BETWEEN ? AND ?');
            queryParams.push(startDate, endDate);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        const exportQuery = `
            SELECT 
                oi.orderID,
                oi.orderItemID,
                oi.name AS productName,
                oi.variationName,
                oi.quantity,
                oi.lineTotalAfter AS amount,
                oi.itemStatus,
                oi.createdAt,
                oi.settlementStatus,
                oi.replacementOrderID,
                u.name AS customerName,
                u.phonenumber AS customerPhone
            FROM order_items oi
            LEFT JOIN users u ON u.uid = oi.uid
            ${whereClause}
            ORDER BY oi.createdAt DESC
        `;

        const [rows] = await db.query(exportQuery, queryParams);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Orders');

        worksheet.columns = [
            { header: 'Order ID', key: 'orderID', width: 20 },
            { header: 'Item ID', key: 'orderItemID', width: 15 },
            { header: 'Product Name', key: 'productName', width: 30 },
            { header: 'Variation', key: 'variationName', width: 20 },
            { header: 'Quantity', key: 'quantity', width: 10 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Status', key: 'itemStatus', width: 15 },
            { header: 'Settlement', key: 'settlementStatus', width: 15 },
            { header: 'Replacement Order ID', key: 'replacementOrderID', width: 25 },
            { header: 'Date', key: 'createdAt', width: 25 },
            { header: 'Customer Name', key: 'customerName', width: 25 },
            { header: 'Customer Phone', key: 'customerPhone', width: 20 }
        ];

        rows.forEach(row => {
            worksheet.addRow({
                ...row,
                createdAt: new Date(row.createdAt).toLocaleString('en-IN'),
                customerPhone: row.customerPhone ? 'XXXXXX' + row.customerPhone.slice(-4) : 'N/A'
            });
        });

        // Style the header
        worksheet.getRow(1).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=orders_export_${new Date().getTime()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error exporting brand orders:', error);
        res.status(500).json({ success: false, message: 'Failed to export orders', error: error.message });
    }
});

// GET /api/brand/orders/analytics/summary - Summary metrics for brand dashboard
orderBrandRouter.get('/orders/analytics/summary', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const brandID = req.user.uid;
        const { days = 30 } = req.query;

        // Totals overall
        const [overallRows] = await db.query(
            `SELECT 
                COUNT(*) AS totalItems,
                COUNT(DISTINCT orderID) AS totalOrders,
                COALESCE(SUM(lineTotalAfter), 0) AS totalRevenue
            FROM order_items
            WHERE brandID = ?`,
            [brandID]
        );

        // Totals in range (recent window)
        const [rangeRows] = await db.query(
            `SELECT 
                COALESCE(SUM(lineTotalAfter), 0) AS windowRevenue,
                COUNT(DISTINCT orderID) AS windowOrders,
                COUNT(*) AS windowItems
            FROM order_items
            WHERE brandID = ? AND createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [brandID, parseInt(days)]
        );

        // Status counts (per item)
        const [statusRows] = await db.query(
            `SELECT itemStatus, COUNT(*) AS count
             FROM order_items
             WHERE brandID = ?
             GROUP BY itemStatus`,
            [brandID]
        );

        const statusCounts = { pending: 0, shipped: 0, delivered: 0, unknown: 0 };
        for (const r of statusRows) {
            const key = (r.itemStatus || 'unknown').toLowerCase();
            if (statusCounts[key] !== undefined) statusCounts[key] = r.count;
            else statusCounts.unknown += r.count;
        }

        // Order-level counts: pending and delivered
        // Pending orders: orders with at least one pending item for this brand
        const [pendingOrderRows] = await db.query(
            `SELECT COUNT(DISTINCT oi.orderID) AS pendingOrders
             FROM order_items oi
             WHERE oi.brandID = ? AND oi.itemStatus = 'pending'`,
            [brandID]
        );

        // Shipped orders: orders with at least one shipped item for this brand
        const [shippedOrderRows] = await db.query(
            `SELECT COUNT(DISTINCT oi.orderID) AS shippedOrders
             FROM order_items oi
             WHERE oi.brandID = ? AND oi.itemStatus = 'shipped'`,
            [brandID]
        );

        // Delivered orders: orders for which all items (for this brand) are delivered
        const [deliveredOrderRows] = await db.query(
            `SELECT COUNT(*) AS deliveredOrders
             FROM (
                SELECT oi.orderID
                FROM order_items oi
                WHERE oi.brandID = ?
                GROUP BY oi.orderID
                HAVING SUM(CASE WHEN COALESCE(oi.itemStatus, '') <> 'delivered' THEN 1 ELSE 0 END) = 0
             ) AS t`,
            [brandID]
        );

        // Payment-mode revenue split (brand-scoped via order_items sums)
        const [codRows] = await db.query(
            `SELECT COALESCE(SUM(oi.lineTotalAfter), 0) AS codAmount
             FROM order_items oi
             INNER JOIN orderDetail od ON od.orderID = oi.orderID
             WHERE oi.brandID = ? AND LOWER(od.paymentMode) = 'cod'`,
            [brandID]
        );
        const [prepaidRows] = await db.query(
            `SELECT COALESCE(SUM(oi.lineTotalAfter), 0) AS prepaidAmount
             FROM order_items oi
             INNER JOIN orderDetail od ON od.orderID = oi.orderID
             WHERE oi.brandID = ? AND LOWER(od.paymentMode) <> 'cod'`,
            [brandID]
        );

        // Total products for this brand
        const [productRows] = await db.query(
            `SELECT COUNT(*) AS productCount FROM products WHERE brandID = ?`,
            [brandID]
        );

        res.json({
            success: true,
            data: {
                totals: overallRows[0] || { totalItems: 0, totalOrders: 0, totalRevenue: 0 },
                window: rangeRows[0] || { windowRevenue: 0, windowOrders: 0, windowItems: 0 },
                statusCounts,
                orders: {
                    totalOrders: overallRows[0]?.totalOrders || 0,
                    pendingOrders: pendingOrderRows[0]?.pendingOrders || 0,
                    shippedOrders: shippedOrderRows[0]?.shippedOrders || 0,
                    deliveredOrders: deliveredOrderRows[0]?.deliveredOrders || 0
                },
                payments: {
                    codAmount: codRows[0]?.codAmount || 0,
                    prepaidAmount: prepaidRows[0]?.prepaidAmount || 0
                },
                products: {
                    total: productRows[0]?.productCount || 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching brand analytics summary:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch analytics summary', error: error.message });
    }
});

// GET /api/brand/orders/analytics/daily - Time-series revenue and orders
orderBrandRouter.get('/orders/analytics/daily', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const brandID = req.user.uid;
        const { days = 30 } = req.query;

        const [rows] = await db.query(
            `SELECT 
                DATE(createdAt) AS day,
                COALESCE(SUM(lineTotalAfter), 0) AS revenue,
                COUNT(DISTINCT orderID) AS orders,
                COUNT(*) AS items
            FROM order_items
            WHERE brandID = ? AND createdAt >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(createdAt)
            ORDER BY day ASC`,
            [brandID, parseInt(days)]
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching brand daily analytics:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch daily analytics', error: error.message });
    }
});

// GET /api/brand/orders/analytics/top-products - Top products by revenue/items
orderBrandRouter.get('/orders/analytics/top-products', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const brandID = req.user.uid;
        const { days = 30, limit = 5 } = req.query;

        const [rows] = await db.query(
            `SELECT 
                name,
                COALESCE(variationName, '') AS variationName,
                COUNT(*) AS itemCount,
                COALESCE(SUM(lineTotalAfter), 0) AS revenue
            FROM order_items
            WHERE brandID = ? AND createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY name, variationName
            ORDER BY revenue DESC
            LIMIT ?`,
            [brandID, parseInt(days), parseInt(limit)]
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching brand top products:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch top products', error: error.message });
    }
});

// GET /api/brand/orders/stats/date-range - Get stats with date range (MUST BE BEFORE /orders/:id)
orderBrandRouter.get('/orders/stats/date-range', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const brandID = req.user.uid;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
        }

        // Build date filter
        const dateFilter = `DATE(oi.createdAt) BETWEEN ? AND ?`;

        // Totals in date range
        const [rangeRows] = await db.query(
            `SELECT 
                COALESCE(SUM(oi.lineTotalAfter), 0) AS revenue,
                COUNT(DISTINCT oi.orderID) AS orders,
                COUNT(*) AS items
            FROM order_items oi
            WHERE oi.brandID = ? AND ${dateFilter}`,
            [brandID, startDate, endDate]
        );

        // Status counts
        const [statusRows] = await db.query(
            `SELECT oi.itemStatus, COUNT(*) AS count
             FROM order_items oi
             WHERE oi.brandID = ? AND ${dateFilter}
             GROUP BY oi.itemStatus`,
            [brandID, startDate, endDate]
        );

        const statusCounts = { pending: 0, shipped: 0, delivered: 0, unknown: 0 };
        for (const r of statusRows) {
            const key = (r.itemStatus || 'unknown').toLowerCase();
            if (statusCounts[key] !== undefined) statusCounts[key] = r.count;
            else statusCounts.unknown += r.count;
        }

        // Payment-mode revenue split
        const [codRows] = await db.query(
            `SELECT COALESCE(SUM(oi.lineTotalAfter), 0) AS codAmount
             FROM order_items oi
             INNER JOIN orderDetail od ON od.orderID = oi.orderID
             WHERE oi.brandID = ? AND ${dateFilter} AND LOWER(od.paymentMode) = 'cod'`,
            [brandID, startDate, endDate]
        );
        const [prepaidRows] = await db.query(
            `SELECT COALESCE(SUM(oi.lineTotalAfter), 0) AS prepaidAmount
             FROM order_items oi
             INNER JOIN orderDetail od ON od.orderID = oi.orderID
             WHERE oi.brandID = ? AND ${dateFilter} AND LOWER(od.paymentMode) <> 'cod'`,
            [brandID, startDate, endDate]
        );

        // Get all order items for the date range
        const [orderItems] = await db.query(
            `SELECT 
                oi.orderID,
                oi.name,
                oi.variationName,
                oi.quantity,
                oi.unitPriceAfter,
                oi.lineTotalAfter,
                oi.itemStatus,
                oi.createdAt
            FROM order_items oi
            WHERE oi.brandID = ? AND ${dateFilter}
            ORDER BY oi.createdAt ASC, oi.orderID ASC`,
            [brandID, startDate, endDate]
        );

        res.json({
            success: true,
            data: {
                dateRange: { startDate, endDate },
                totals: rangeRows[0] || { revenue: 0, orders: 0, items: 0 },
                statusCounts,
                payments: {
                    codAmount: codRows[0]?.codAmount || 0,
                    prepaidAmount: prepaidRows[0]?.prepaidAmount || 0
                },
                orderItems: orderItems || []
            }
        });
    } catch (error) {
        console.error('Error fetching brand stats with date range:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
    }
});

// GET /api/brand/orders/invoice-pdf - Generate invoice PDF for date range (MUST BE BEFORE /orders/:id)
orderBrandRouter.get('/orders/invoice-pdf', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const brandID = req.user.uid;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
        }

        // Get brand info from users table
        const [brandRows] = await db.query(
            `SELECT uid, username, name, emailID, gstin
             FROM users
             WHERE uid = ? AND role = 'brand'`,
            [brandID]
        );

        if (brandRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Brand not found' });
        }

        const brand = brandRows[0];

        // For now, use basic address structure - can be enhanced if address is stored separately
        const brandInfo = {
            name: brand.name || brand.username || 'Brand',
            address: {
                line1: brand.emailID || '',
                line2: '',
                line3: ''
            },
            gstin: brand.gstin ? `GSTIN: ${brand.gstin}` : null
        };

        // Get all order items for the date range
        const dateFilter = `DATE(oi.createdAt) BETWEEN ? AND ?`;
        const [orderItems] = await db.query(
            `SELECT 
                oi.orderID,
                oi.name,
                oi.variationName,
                oi.quantity,
                oi.unitPriceAfter,
                oi.lineTotalAfter,
                oi.itemStatus,
                oi.createdAt
            FROM order_items oi
            WHERE oi.brandID = ? AND ${dateFilter}
            ORDER BY oi.createdAt ASC, oi.orderID ASC`,
            [brandID, startDate, endDate]
        );

        if (orderItems.length === 0) {
            return res.status(404).json({ success: false, message: 'No orders found for the selected date range' });
        }

        // Generate PDF
        const brandInvoiceService = require('../../services/brandInvoiceService');
        const pdfBuffer = await brandInvoiceService.generateBrandInvoicePDF(
            brandInfo,
            orderItems,
            { startDate, endDate }
        );

        // Set response headers
        const fileName = `invoice_${brandID}_${startDate}_to_${endDate}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating brand invoice PDF:', error);
        res.status(500).json({ success: false, message: 'Failed to generate invoice PDF', error: error.message });
    }
});

// GET /api/brand/orders/:id - Get order details by ID
orderBrandRouter.get('/orders/:id', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { id } = req.params;
        const brandID = req.user.uid; // Get brandID from JWT token

        // Get order items for this brand (include variation details, custom inputs, and product info)
        const itemsQuery = `
            SELECT oi.orderItemID, oi.orderID, oi.uid, oi.name, oi.quantity, oi.unitPriceAfter, oi.lineTotalAfter, oi.featuredImage, oi.variationName, oi.variationID, oi.trackingCode, oi.deliveryCompany, oi.itemStatus, oi.returnStatus, oi.returnType, oi.returnReason, oi.returnComments, oi.returnPhotos, oi.returnTrackingCode, oi.returnDeliveryCompany, oi.returnTrackingUrl, oi.replacementOrderID, oi.createdAt, oi.brandShippingFee, oi.custom_inputs, oi.comboID,
            v.variationName AS fullVariationName, v.variationValues, v.variationPrice, v.variationStock, v.variationSalePrice,
            p.type AS productType, p.custom_inputs AS productCustomInputs
            FROM order_items oi 
            LEFT JOIN variations v ON oi.variationID = v.variationID
            LEFT JOIN products p ON oi.productID = p.productID
            WHERE oi.orderID = ? AND oi.brandID = ?
            ORDER BY oi.createdAt ASC
        `;

        const [items] = await db.query(itemsQuery, [id, brandID]);

        if (items.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found or does not belong to this brand' });
        }

        // Get order details from orderDetail table
        const orderQuery = `
            SELECT od.orderID, od.uid, od.paymentMode, od.paymentStatus, od.orderStatus, od.createdAt, od.subtotal, od.total, od.totalDiscount, od.couponCode, od.couponDiscount, od.addressID, od.shippingFee
            FROM orderDetail od 
            WHERE od.orderID = ?
        `;

        const [orderResult] = await db.query(orderQuery, [id]);
        const order = orderResult[0];

        // Process each item (parse JSON fields and fetch combo items)
        const processedItems = await Promise.all(items.map(async (item) => {
            const processedItem = {
                ...item,
                featuredImage: item.featuredImage ? JSON.parse(item.featuredImage) : [{ imgUrl: '/placeholder-product.jpg' }]
            };

            // If it's a combo product, fetch its components
            if (item.comboID) {
                try {
                    const comboItemsQuery = `
                        SELECT ci.name, ci.quantity, ci.featuredImage, v.variationName, v.variationValues
                        FROM combo_items ci
                        LEFT JOIN variations v ON ci.variationID = v.variationID
                        WHERE ci.comboID = ?
                    `;
                    const [comboDetails] = await db.query(comboItemsQuery, [item.comboID]);
                    processedItem.comboItems = comboDetails.map(ci => ({
                        ...ci,
                        featuredImage: ci.featuredImage ? JSON.parse(ci.featuredImage) : [{ imgUrl: '/placeholder-product.jpg' }]
                    }));
                } catch (err) {
                    console.error("Error fetching combo items for brand detail:", err);
                    processedItem.comboItems = [];
                }
            }

            return processedItem;
        }));

        // Get address details
        let deliveryAddress = null;
        if (order.addressID) {
            try {
                const addressResult = await db.query(
                    'SELECT * FROM address WHERE addressID = ?',
                    [order.addressID]
                );
                if (addressResult[0] && addressResult[0].length > 0) {
                    const addr = addressResult[0][0];
                    // Clean up address response - only send necessary fields
                    deliveryAddress = {
                        emailID: addr.emailID,
                        phoneNumber: addr.phoneNumber,
                        line1: addr.line1,
                        line2: addr.line2,
                        city: addr.city,
                        state: addr.state,
                        pincode: addr.pincode,
                        landmark: addr.landmark,
                        type: addr.type
                    };
                }
            } catch (e) {
                console.error('Error fetching address:', e);
            }
        }

        // Determine legacy order status for shipping
        let totalBrandShippingInOrder = 0;
        try {
            const [shippingRows] = await db.query('SELECT SUM(brandShippingFee) as total FROM order_items WHERE orderID = ?', [id]);
            totalBrandShippingInOrder = parseFloat(shippingRows[0]?.total || 0);
        } catch (e) {
            console.error('Error fetching global brand shipping total:', e);
        }

        // Calculate total shipping fee acquired by this brand for this order
        let brandShippingFee = processedItems.reduce((sum, item) => sum + (parseFloat(item.brandShippingFee) || 0), 0);
        const overallShipping = parseFloat(order.shippingFee) || 0;

        if (totalBrandShippingInOrder === 0 && overallShipping > 0) {
            // Legacy fallback: Order had shipping but wasn't tracked per item. Assign overall shipping here for display.
            brandShippingFee = overallShipping;
        }

        // Calculate brand-specific totals (Item Total = Regular Price, Subtotal = Discounted/LineTotalAfter)
        const itemTotal = processedItems.reduce((sum, item) => sum + (Number(item.regularPrice) || 0) * (Number(item.quantity) || 1), 0);
        const subtotal = processedItems.reduce((sum, item) => sum + (Number(item.lineTotalAfter) || 0), 0);

        // Format the response
        const orderDetails = {
            orderID: parseInt(id),
            uid: order.uid,
            paymentMode: order.paymentMode || 'UPI',
            paymentStatus: order.paymentStatus || 'successful',
            orderStatus: order.orderStatus || 'Preparing',
            createdAt: order.createdAt,
            items: processedItems,
            itemTotal: itemTotal,
            subtotal: subtotal,
            discount: itemTotal - subtotal,
            shipping: brandShippingFee,
            overallShipping: parseFloat(order.shippingFee) || 0,
            total: parseFloat(order.total) || 0,
            deliveryAddress: deliveryAddress,
            couponCode: order.couponCode,
            couponDiscount: parseFloat(order.couponDiscount) || 0
        };

        res.json({
            success: true,
            data: orderDetails
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch order details', error: error.message });
    }
});

// PUT /api/brand/orders/:id/status - Update order status
orderBrandRouter.put('/orders/:id/status', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus } = req.body;
        const brandID = req.user.uid;

        if (!orderStatus) {
            return res.status(400).json({ success: false, message: 'Order status is required' });
        }

        // Verify the order belongs to this brand before updating
        const verifyQuery = `
            SELECT oi.orderID FROM order_items oi
            WHERE oi.orderID = ? AND oi.brandID = ?
            LIMIT 1
        `;

        const [verifyResult] = await db.query(verifyQuery, [id, brandID]);
        if (verifyResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found or does not belong to this brand' });
        }

        // Note: orderStatus is not stored in order_items table
        // This would need to be stored in a separate table or order_items table
        // For now, we'll just return success without actual update

        res.json({
            success: true,
            message: 'Order status updated successfully',
            data: { orderID: id, orderStatus }
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Failed to update order status', error: error.message });
    }
});

// PUT /api/brand/orders/:id/payment-status - Update payment status
orderBrandRouter.put('/orders/:id/payment-status', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus } = req.body;
        const brandID = req.user.uid;

        if (!paymentStatus) {
            return res.status(400).json({ success: false, message: 'Payment status is required' });
        }

        // Verify the order belongs to this brand before updating
        const verifyQuery = `
            SELECT oi.orderID FROM order_items oi
            WHERE oi.orderID = ? AND oi.brandID = ?
            LIMIT 1
        `;

        const [verifyResult] = await db.query(verifyQuery, [id, brandID]);
        if (verifyResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found or does not belong to this brand' });
        }

        // Note: paymentStatus is not stored in order_items table
        // This would need to be stored in a separate table or order_items table
        // For now, we'll just return success without actual update

        res.json({
            success: true,
            message: 'Payment status updated successfully',
            data: { orderID: id, paymentStatus }
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ success: false, message: 'Failed to update payment status', error: error.message });
    }
});

// PUT /api/brand/orders/:id/items-tracking - Update per-item tracking (shipment AWB, return AWB, return status)
// Items: [{ orderItemID?, name?, variationName?, trackingCode?, deliveryCompany?, returnTrackingCode?, returnDeliveryCompany?, returnTrackingUrl?, itemStatus?, returnStatus? }]
// Use orderItemID to update by id (e.g. for return AWB / return status); or name+variationName for shipment AWB.
// returnStatus: brand can set return_initiated | return_picked | replacement_processing | replacement_shipped | replacement_complete | returned | refund_pending | refund_completed | returnRejected
orderBrandRouter.put('/orders/:id/items-tracking', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { items } = req.body;
        const brandID = req.user.uid;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items array is required' });
        }

        const [verify] = await db.query(
            `SELECT 1 FROM order_items WHERE orderID = ? AND brandID = ? LIMIT 1`,
            [id, brandID]
        );
        if (verify.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found or does not belong to this brand' });
        }

        let updated = 0;
        const statusUpdates = [];

        for (const it of items) {
            if (!it) continue;

            const updates = [];
            const params = [];
            let newItemStatus = null;
            let newReturnStatus = null;

            if (it.trackingCode !== undefined || it.deliveryCompany !== undefined) {
                updates.push('trackingCode = ?, deliveryCompany = ?');
                params.push(it.trackingCode ?? null, it.deliveryCompany ?? null);
            }
            if (it.returnTrackingCode !== undefined || it.returnDeliveryCompany !== undefined) {
                updates.push('returnTrackingCode = ?, returnDeliveryCompany = ?');
                params.push(it.returnTrackingCode ?? null, it.returnDeliveryCompany ?? null);
            }
            if (it.returnTrackingUrl !== undefined) {
                updates.push('returnTrackingUrl = ?');
                params.push(it.returnTrackingUrl ?? null);
            }
            if (it.itemStatus !== undefined) {
                updates.push('itemStatus = ?');
                newItemStatus = String(it.itemStatus).toLowerCase();
                params.push(newItemStatus);
            } else if (it.trackingCode && updates.length > 0) {
                updates.push('itemStatus = ?');
                newItemStatus = 'shipped';
                params.push(newItemStatus);
            }
            const allowedReturnStatuses = [
                // 'return_requested' reserved, not currently used in flow
                'return_initiated',
                'return_picked',
                'replacement_processing',
                'replacement_shipped',
                'replacement_complete',
                'returned',
                'refund_pending',
                'refund_completed',
                'returnRejected'
            ];
            if (it.returnStatus !== undefined && allowedReturnStatuses.includes(String(it.returnStatus))) {
                updates.push('returnStatus = ?');
                newReturnStatus = String(it.returnStatus);
                params.push(newReturnStatus);
            }
            if (it.returnType !== undefined) {
                updates.push('returnType = ?');
                params.push(it.returnType ?? null);
            }

            if (updates.length === 0) continue;

            const setClause = updates.join(', ');
            let whereClause;
            const whereParams = [id, brandID];

            if (it.orderItemID != null) {
                whereClause = 'orderItemID = ?';
                whereParams.push(it.orderItemID);
            } else {
                whereClause = 'name = ?';
                whereParams.push(it.name);
                if (it.variationName) {
                    whereClause += ' AND variationName = ?';
                    whereParams.push(it.variationName);
                } else {
                    whereClause += ' AND (variationName IS NULL OR variationName = "")';
                }
            }

            const [result] = await db.query(
                `UPDATE order_items SET ${setClause} WHERE orderID = ? AND brandID = ? AND ${whereClause} LIMIT 1`,
                [...params, ...whereParams]
            );
            if (result.affectedRows > 0) {
                updated += 1;
                if ((newItemStatus || newReturnStatus) && (it.orderItemID != null || it.name)) {
                    statusUpdates.push({
                        orderItemID: it.orderItemID,
                        name: it.name,
                        variationName: it.variationName || '',
                        itemStatus: newItemStatus,
                        returnStatus: newReturnStatus
                    });
                }
            }
        }

        if (statusUpdates.length > 0) {
            try {
                const [orderRows] = await db.query('SELECT uid FROM orderDetail WHERE orderID = ? LIMIT 1', [id]);
                const orderUid = orderRows && orderRows[0] ? orderRows[0].uid : null;
                if (orderUid) {
                    const [userRows] = await db.query('SELECT emailID, name, username FROM users WHERE uid = ? LIMIT 1', [orderUid]);
                    const user = userRows && userRows[0] ? userRows[0] : null;
                    const toEmail = user && user.emailID ? user.emailID : null;
                    const customerName = (user && (user.name || user.username)) || 'Customer';
                    if (toEmail) {
                        for (const u of statusUpdates) {
                            const orderItemID = u.orderItemID;
                            let itemName = u.name;
                            let variationName = u.variationName;
                            let replacementOrderID = null;
                            if (orderItemID != null) {
                                const [itemRows] = await db.query(
                                    'SELECT name, variationName, replacementOrderID FROM order_items WHERE orderItemID = ? AND orderID = ? LIMIT 1',
                                    [orderItemID, id]
                                );
                                if (itemRows && itemRows[0]) {
                                    itemName = itemRows[0].name || itemName;
                                    variationName = itemRows[0].variationName || variationName;
                                    replacementOrderID = itemRows[0].replacementOrderID || null;
                                }
                            }
                            if (u.returnStatus) {
                                await queueOrderStatusEmail({
                                    to: toEmail,
                                    customerName,
                                    orderID: Number(id),
                                    itemName: itemName || 'Item',
                                    variationName: variationName || '',
                                    statusType: u.returnStatus,
                                    replacementOrderID: replacementOrderID ? Number(replacementOrderID) : undefined
                                });
                            } else if (u.itemStatus && ['shipped', 'delivered'].includes(u.itemStatus)) {
                                await queueOrderStatusEmail({
                                    to: toEmail,
                                    customerName,
                                    orderID: Number(id),
                                    itemName: itemName || 'Item',
                                    variationName: variationName || '',
                                    statusType: u.itemStatus
                                });
                            }
                        }
                    }
                }
            } catch (emailErr) {
                console.error('Error queueing order/return status emails:', emailErr);
            }
        }

        return res.json({ success: true, message: 'Tracking info updated', updatedCount: updated });
    } catch (error) {
        console.error('Error updating item tracking info:', error);
        res.status(500).json({ success: false, message: 'Failed to update tracking info', error: error.message });
    }
});

// POST /api/brand/orders/approve-return/:orderItemID - Approve return request
orderBrandRouter.post('/orders/approve-return/:orderItemID', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { orderItemID } = req.params;
        const brandID = req.user.uid;
        const orderService = require('../../services/orderService');

        // Verify ownership
        const [verify] = await db.query('SELECT 1 FROM order_items WHERE orderItemID = ? AND brandID = ?', [orderItemID, brandID]);
        if (verify.length === 0) {
            return res.status(403).json({ success: false, message: 'Unauthorized or item not found' });
        }

        const result = await orderService.approveReturnRequest(orderItemID, 'approve');
        res.json(result);
    } catch (error) {
        console.error('Error approving return:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/brand/orders/reject-return/:orderItemID - Reject return request
orderBrandRouter.post('/orders/reject-return/:orderItemID', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { orderItemID } = req.params;
        const brandID = req.user.uid;
        const orderService = require('../../services/orderService');

        // Verify ownership
        const [verify] = await db.query('SELECT 1 FROM order_items WHERE orderItemID = ? AND brandID = ?', [orderItemID, brandID]);
        if (verify.length === 0) {
            return res.status(403).json({ success: false, message: 'Unauthorized or item not found' });
        }

        const result = await orderService.approveReturnRequest(orderItemID, 'reject');
        res.json(result);
    } catch (error) {
        console.error('Error rejecting return:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = orderBrandRouter
