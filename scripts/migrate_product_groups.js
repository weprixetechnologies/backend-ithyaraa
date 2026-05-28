require('dotenv').config();
const db = require('../utils/dbconnect');

async function migrate() {
  try {
    console.log('Starting migration for product_groups...');
    
    // Add routeTo
    try {
      await db.query(`ALTER TABLE product_groups ADD COLUMN routeTo VARCHAR(255) DEFAULT NULL AFTER isBannerised`);
      console.log('Added routeTo column.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Column routeTo already exists.');
      } else {
        throw err;
      }
    }

    // Add filters
    try {
      await db.query(`ALTER TABLE product_groups ADD COLUMN filters TEXT DEFAULT NULL AFTER routeTo`);
      console.log('Added filters column.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Column filters already exists.');
      } else {
        throw err;
      }
    }

    console.log('Migration successful.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
