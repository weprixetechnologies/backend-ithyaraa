const db = require('../utils/dbconnect');

async function run() {
  try {
    await db.query(`ALTER TABLE cart_items ADD COLUMN isFlashSale TINYINT(1) NOT NULL DEFAULT 0`);
    console.log('isFlashSale column added to cart_items');
  } catch (e) {
    if (String(e.message || '').includes('Duplicate column name')) {
      console.log('isFlashSale column already exists');
    } else {
      console.error('Failed to add isFlashSale column:', e);
      process.exitCode = 1;
    }
  } finally {
    process.exit();
  }
}

run();


