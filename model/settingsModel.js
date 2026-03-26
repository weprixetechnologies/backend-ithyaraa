const db = require('../utils/dbconnect');

async function getSetting(key) {
    try {
        const [rows] = await db.query('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
        return rows[0] ? rows[0].setting_value : null;
    } catch (err) {
        console.error(`Error fetching setting ${key}:`, err);
        throw err;
    }
}

async function updateSetting(key, value) {
    try {
        const [result] = await db.query(
            'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, String(value), String(value)]
        );
        return result.affectedRows > 0;
    } catch (err) {
        console.error(`Error updating setting ${key}:`, err);
        throw err;
    }
}

async function getAllSettings() {
    try {
        const [rows] = await db.query('SELECT setting_key, setting_value FROM settings');
        return rows.reduce((acc, row) => {
            acc[row.setting_key] = row.setting_value;
            return acc;
        }, {});
    } catch (err) {
        console.error('Error fetching all settings:', err);
        throw err;
    }
}

module.exports = {
    getSetting,
    updateSetting,
    getAllSettings
};
