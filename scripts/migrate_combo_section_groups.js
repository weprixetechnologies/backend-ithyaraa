const db = require('../utils/dbconnect');

async function run() {
    try {
        console.log('Creating combo_section_groups table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS \`combo_section_groups\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`sectionID\` INT NOT NULL,
              \`title\` VARCHAR(255) NULL,
              \`orderIndex\` INT DEFAULT 0,
              \`imageUrl\` TEXT NULL,
              \`isBannerised\` TINYINT(1) DEFAULT 0,
              \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        console.log('Creating combo_section_group_products table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS \`combo_section_group_products\` (
              \`id\` INT NOT NULL AUTO_INCREMENT,
              \`groupID\` INT NOT NULL,
              \`comboProductID\` VARCHAR(255) NOT NULL,
              \`position\` INT DEFAULT 0,
              \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              UNIQUE KEY \`ux_combo_group_product\` (\`groupID\`, \`comboProductID\`),
              INDEX \`idx_combo_groupID\` (\`groupID\`),
              CONSTRAINT \`fk_combo_group_products_group\` FOREIGN KEY (\`groupID\`) REFERENCES \`combo_section_groups\`(\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_combo_group_products_product\` FOREIGN KEY (\`comboProductID\`) REFERENCES \`products\`(\`productID\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        console.log('Creating offer_section_items table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS \`offer_section_items\` (
              \`id\` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
              \`type\` varchar(64) NOT NULL,
              \`itemId\` bigint(20) unsigned NOT NULL,
              \`orderIndex\` int(11) NOT NULL DEFAULT 0,
              \`createdAt\` timestamp NOT NULL DEFAULT current_timestamp(),
              \`updatedAt\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
              PRIMARY KEY (\`id\`),
              KEY \`idx_type_order\` (\`type\`,\`orderIndex\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        console.log('Success! Combo group and offer section tables created.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

run();
