const db = require('../utils/dbconnect');

const migrate = async () => {
    try {
        const sql = `ALTER TABLE featured_coupons ADD COLUMN couponCode VARCHAR(255) DEFAULT NULL AFTER iconImage;`;
        await db.query(sql);
        console.log('Column couponCode added to featured_coupons table.');
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Column couponCode already exists.');
            process.exit(0);
        }
        console.error('Error migrating table:', error);
        process.exit(1);
    }
};

migrate();
