const db = require('../utils/dbconnect');

async function check() {
    try {
        const [columns] = await db.query('DESCRIBE users');
        console.log('--- users table columns ---');
        console.log(columns.map(c => `${c.Field} (${c.Type}) - Null: ${c.Null}`));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
