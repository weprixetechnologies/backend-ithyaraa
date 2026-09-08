const db = require('../utils/dbconnect');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('Running product badges migration...');
        const sqlPath = path.join(__dirname, '../migrations/2026_09_08_create_product_badges.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split multiple queries
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            await db.query(statement);
        }

        // Alter column productID to VARCHAR(255) if table was previously created as BIGINT
        try {
            await db.query(`ALTER TABLE product_badge_mappings MODIFY COLUMN productID VARCHAR(255) NOT NULL`);
            console.log('Altered product_badge_mappings.productID column type to VARCHAR(255)!');
        } catch (alterErr) {
            console.log('Column alter note:', alterErr.message);
        }

        console.log('Product badges migration executed successfully!');

        // Check if sample badges should be seeded
        const [rows] = await db.query('SELECT COUNT(*) as count FROM product_badges');
        if (rows[0].count === 0) {
            console.log('Seeding initial default badges...');
            await db.query(`
                INSERT INTO product_badges (name, bgColor, textColor, icon, isActive, displayOrder) VALUES
                ('Best Seller', '#ef4444', '#ffffff', '🔥', 1, 1),
                ('Trending', '#8b5cf6', '#ffffff', '⚡', 1, 2),
                ('Hot Deal', '#f97316', '#ffffff', '🏷️', 1, 3),
                ('Limited Edition', '#059669', '#ffffff', '👑', 1, 4),
                ('New Arrival', '#2563eb', '#ffffff', '⭐', 1, 5)
            `);
            console.log('Default badges seeded successfully!');
        }

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
