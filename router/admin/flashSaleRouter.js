const express = require('express');
const router = express.Router();
const db = require('../../utils/dbconnect');
const { detectFlashSaleSchema } = require('../../utils/flashSaleSchema');
const authAdminMiddleware = require('../../middleware/authAdminMiddleware');

router.use(authAdminMiddleware.verifyAccessToken);

// List flash sale details
router.get('/', async (req, res) => {
  try {
    const schema = await detectFlashSaleSchema();
    const d = schema.details;
    const i = schema.items;
    const orderCol = d.updatedAt ? `ORDER BY ${d.updatedAt} DESC` : (d.createdAt ? `ORDER BY ${d.createdAt} DESC` : '');
    const [details] = await db.query(`SELECT * FROM ${schema.tables.details} ${orderCol}`);
    const [counts] = await db.query(`SELECT ${i.saleID} AS saleID, COUNT(*) AS itemCount FROM ${schema.tables.items} GROUP BY ${i.saleID}`);
    const saleIdToCount = new Map(counts.map(r => [r.saleID, r.itemCount]));
    const data = (details || []).map(row => ({
      ...row,
      itemCount: saleIdToCount.get(row[d.saleID]) || 0
    }));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Failed to list flash sales' });
  }
});

// Create flash sale detail
router.post('/', async (req, res) => {
  try {
    const schema = await detectFlashSaleSchema();
    const d = schema.details;
    const body = req.body || {};
    const id = body.saleID || `FS-${Date.now()}`;
    const cols = [d.saleID, d.name]
      .concat(d.startTime ? [d.startTime] : [])
      .concat(d.endTime ? [d.endTime] : [])
      .concat(d.status ? [d.status] : [])
      .concat(d.metadata ? [d.metadata] : []);
    const placeholders = cols.map(() => '?').join(',');
    const values = [id, body.name || body.title || null];
    if (d.startTime) values.push(body.startTime || body.start_time || null);
    if (d.endTime) values.push(body.endTime || body.end_time || null);
    if (d.status) values.push(body.status || 'active');
    if (d.metadata) values.push(body.metadata ? JSON.stringify(body.metadata) : null);
    await db.query(`INSERT INTO ${schema.tables.details} (${cols.join(',')}) VALUES (${placeholders})`, values);
    res.json({ success: true, saleID: id });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Failed to create flash sale' });
  }
});

// Update flash sale detail
router.put('/:saleID', async (req, res) => {
  try {
    const { saleID } = req.params;
    const schema = await detectFlashSaleSchema();
    const d = schema.details;
    const body = req.body || {};
    // Build partial update only for provided non-empty fields to avoid NOT NULL violations
    const updatePairs = [];
    const values = [];
    const nameVal = body.name ?? body.title;
    if (nameVal !== undefined && nameVal !== '') { updatePairs.push(`${d.name} = ?`); values.push(nameVal); }
    if (d.startTime) {
      const st = body.startTime ?? body.start_time;
      if (st !== undefined && st !== '') { updatePairs.push(`${d.startTime} = ?`); values.push(st); }
    }
    if (d.endTime) {
      const et = body.endTime ?? body.end_time;
      if (et !== undefined && et !== '') { updatePairs.push(`${d.endTime} = ?`); values.push(et); }
    }
    if (d.status) {
      const stt = body.status;
      if (stt !== undefined && stt !== '') { updatePairs.push(`${d.status} = ?`); values.push(stt); }
    }
    if (d.metadata) {
      if (body.metadata !== undefined) {
        updatePairs.push(`${d.metadata} = ?`);
        values.push(body.metadata ? JSON.stringify(body.metadata) : null);
      }
    }

    if (updatePairs.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const sql = `UPDATE ${schema.tables.details} SET ${updatePairs.join(', ')} WHERE ${d.saleID} = ?`;
    values.push(saleID);
    await db.query(sql, values);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Failed to update flash sale' });
  }
});

// Get flash sale meta by saleID
router.get('/:saleID', async (req, res) => {
  try {
    const { saleID } = req.params;
    const schema = await detectFlashSaleSchema();
    const d = schema.details;
    const [rows] = await db.query(`SELECT * FROM ${schema.tables.details} WHERE ${d.saleID} = ? LIMIT 1`, [saleID]);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Failed to load sale' });
  }
});

// List items for sale
router.get('/:saleID/items', async (req, res) => {
  try {
    const { saleID } = req.params;
    const schema = await detectFlashSaleSchema();
    const i = schema.items;
    const [rows] = await db.query(`SELECT * FROM ${schema.tables.items} WHERE ${i.saleID} = ?`, [saleID]);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Failed to load items' });
  }
});

// Replace items for saleID with provided productIDs
router.post('/:saleID/items', async (req, res) => {
  const conn = await db.getConnection?.();
  try {
    const { saleID } = req.params;
    const schema = await detectFlashSaleSchema();
    const i = schema.items;
    const productIDs = Array.isArray(req.body?.productIDs) ? req.body.productIDs : [];
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (conn) await conn.beginTransaction();
    const exec = async (q, v) => conn ? conn.query(q, v) : db.query(q, v);
    await exec(`DELETE FROM ${schema.tables.items} WHERE ${i.saleID} = ?`, [saleID]);
    let count = 0;
    if (items.length > 0 && i.discountType && i.discountValue) {
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx] || {};
        const pid = it.productID;
        if (!pid) continue;
        const dtype = (it.discountType || '').toLowerCase();
        const dval = Number(it.discountValue || 0);
        const sid = i.saleItemID ? (it.saleItemID || `FSI-${Date.now()}-${idx}`) : null;
        const cols = [i.saleID, i.productID]
          .concat(i.discountType ? [i.discountType] : [])
          .concat(i.discountValue ? [i.discountValue] : [])
          .concat(i.saleItemID ? [i.saleItemID] : []);
        const placeholders = cols.map(() => '?').join(',');
        const vals = [saleID, pid]
          .concat(i.discountType ? [dtype] : [])
          .concat(i.discountValue ? [dval] : [])
          .concat(i.saleItemID ? [sid] : []);
        await exec(`INSERT INTO ${schema.tables.items} (${cols.join(',')}) VALUES (${placeholders})`, vals);
        count++;
      }
    } else {
      for (let idx = 0; idx < productIDs.length; idx++) {
        const pid = productIDs[idx];
        if (!pid) continue;
        const sid = i.saleItemID ? `FSI-${Date.now()}-${idx}` : null;
        const cols = [i.saleID, i.productID].concat(i.saleItemID ? [i.saleItemID] : []);
        const placeholders = cols.map(() => '?').join(',');
        const vals = [saleID, pid].concat(i.saleItemID ? [sid] : []);
        await exec(`INSERT INTO ${schema.tables.items} (${cols.join(',')}) VALUES (${placeholders})`, vals);
        count++;
      }
    }
    if (conn) await conn.commit();
    res.json({ success: true, count });
  } catch (e) {
    if (conn) await conn.rollback();
    res.status(500).json({ success: false, message: e.message || 'Failed to set items' });
  } finally {
    if (conn) conn.release?.();
  }
});

// Remove single product from sale
router.delete('/:saleID/items/:productID', async (req, res) => {
  try {
    const { saleID, productID } = req.params;
    const schema = await detectFlashSaleSchema();
    const i = schema.items;
    await db.query(`DELETE FROM ${schema.tables.items} WHERE ${i.saleID} = ? AND ${i.productID} = ?`, [saleID, productID]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Failed to remove item' });
  }
});

module.exports = router;


