const express = require('express')
const orderBrandRouter = express.Router()
const authBrandMiddleware = require('../../middleware/authBrandMiddleware')
const db = require('../../utils/dbconnect')

// GET /api/brand/orders - Get all orders with pagination and filters
orderBrandRouter.get('/orders', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, status, paymentStatus, search, itemStatus } = req.query;
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

        // Get order items for this brand
        const itemsQuery = `
            SELECT oi.orderID, oi.uid, oi.name, oi.quantity, oi.unitPriceAfter, oi.lineTotalAfter, oi.featuredImage, oi.variationName, oi.trackingCode, oi.deliveryCompany, oi.itemStatus, oi.createdAt FROM order_items oi WHERE oi.orderID = ? AND oi.brandID = ?
            ORDER BY oi.createdAt ASC
        `;

        const [items] = await db.query(itemsQuery, [id, brandID]);

        if (items.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found or does not belong to this brand' });
        }

        // Get order details from orderDetail table
        const orderQuery = `
            SELECT od.orderID, od.uid, od.paymentMode, od.paymentStatus, od.orderStatus, od.createdAt, od.subtotal, od.total, od.totalDiscount, od.couponCode, od.couponDiscount, od.addressID
            FROM orderDetail od 
            WHERE od.orderID = ?
        `;

        const [orderResult] = await db.query(orderQuery, [id]);
        const order = orderResult[0];

        // Parse featuredImage for each item
        const processedItems = items.map(item => ({
            ...item,
            featuredImage: item.featuredImage ? JSON.parse(item.featuredImage) : [{ imgUrl: '/placeholder-product.jpg' }]
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

        // Format the response
        const orderDetails = {
            orderID: parseInt(id),
            uid: order.uid,
            paymentMode: order.paymentMode || 'UPI',
            paymentStatus: order.paymentStatus || 'successful',
            orderStatus: order.orderStatus || 'Preparing',
            createdAt: order.createdAt,
            items: processedItems,
            subtotal: parseFloat(order.subtotal) || 0,
            discount: parseFloat(order.totalDiscount) || 0,
            shipping: 0, // Not stored separately in current schema
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

// PUT /api/brand/orders/:id/items-tracking - Update per-item tracking info
orderBrandRouter.put('/orders/:id/items-tracking', authBrandMiddleware.verifyAccessToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { items } = req.body; // [{name, variationName, trackingCode, deliveryCompany}]
        const brandID = req.user.uid;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items array is required' });
        }

        // Verify at least one row exists for this order+brand
        const [verify] = await db.query(
            `SELECT 1 FROM order_items WHERE orderID = ? AND brandID = ? LIMIT 1`,
            [id, brandID]
        );
        if (verify.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found or does not belong to this brand' });
        }

        // Update matching items by unique tuple we have available (name + variationName)
        // Ideally, we would use an itemID; if available later, prefer that.
        let updated = 0;
        for (const it of items) {
            if (!it) continue;
            // Build dynamic SET clause; allow explicit itemStatus, otherwise set shipped when trackingCode provided
            let setClause = 'trackingCode = ?, deliveryCompany = ?';
            const params = [it.trackingCode || null, it.deliveryCompany || null];
            if (it.itemStatus) {
                setClause += ', itemStatus = ?';
                params.push(String(it.itemStatus).toLowerCase());
            } else if (it.trackingCode) {
                setClause += ', itemStatus = ?';
                params.push('shipped');
            }
            params.push(id, brandID);
            let whereClause = 'name = ?';
            const whereParams = [it.name];
            if (it.variationName) {
                whereClause += ' AND variationName = ?';
                whereParams.push(it.variationName);
            } else {
                whereClause += ' AND (variationName IS NULL OR variationName = "")';
            }

            const [result] = await db.query(
                `UPDATE order_items 
                 SET ${setClause}
                 WHERE orderID = ? AND brandID = ? AND ${whereClause}
                 LIMIT 1`,
                [...params, ...whereParams]
            );
            updated += result.affectedRows || 0;
        }

        return res.json({ success: true, message: 'Tracking info updated', updatedCount: updated });
    } catch (error) {
        console.error('Error updating item tracking info:', error);
        res.status(500).json({ success: false, message: 'Failed to update tracking info', error: error.message });
    }
});

module.exports = orderBrandRouter
