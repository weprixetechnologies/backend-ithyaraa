const fs = require('fs');
const path = require('path');
const db = require('../utils/dbconnect');

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'migrations', '001_create_product_groups.sql'), 'utf8');
    // Split statements by ; but keep it simple: run as a single query
    const statements = sql.split(/;\s*$/m).filter(s => s.trim().length > 0);
    for (const stmt of statements) {
      console.log('Running statement:', stmt.trim().slice(0, 80));
      await db.query(stmt);
    }
    console.log('Migration completed');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

run();

