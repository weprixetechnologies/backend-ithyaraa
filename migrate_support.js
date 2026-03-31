const db = require('./utils/dbconnect');
const fs = require('fs');
const path = require('path');

const migrate = async () => {
    try {
        console.log('Starting Support System Migration...');

        // 1. Create Tables
        const sqlPath = path.join(__dirname, 'sql', 'support_system.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon, but handle procedures if any (not here, but good practice)
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            await db.execute(statement);
        }

        // 2. Add unread columns (handled in sql file already, but can be explicit here if needed)
        // ALREADY HANDLED IN SQL FILE WITH IF NOT EXISTS

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
