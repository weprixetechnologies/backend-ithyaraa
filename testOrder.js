const db = require('./utils/dbconnect');
const { getOrderDetailsByOrderID } = require('./services/orderService');

(async () => {
    try {
        const orderId = '190';
        const [rows] = await db.query('SELECT uid FROM orderDetail WHERE orderID = ?', [orderId]);
        if (!rows || rows.length === 0) { console.log('Order not found'); process.exit(0); }
        const res = await getOrderDetailsByOrderID(orderId, rows[0].uid);
        console.log(JSON.stringify(res.orderDetail, null, 2));
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
})();
