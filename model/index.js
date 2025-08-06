const db = require('../utils/dbconnect');

/**
 * Get total count from a table with optional filters (using LIKE).
 * Ignores filters for columns that don’t exist.
 */
const getTableCount = async ({ tableName, filters = {} }) => {
    const values = [];
    let whereClause = '';

    // 1. Get valid column names from the table
    const [columns] = await db.query(`SHOW COLUMNS FROM ${tableName}`);
    const validColumnNames = columns.map(col => col.Field);

    // 2. Filter out invalid keys
    const safeFilters = Object.keys(filters).reduce((acc, key) => {
        if (validColumnNames.includes(key) && filters[key]) {
            acc[key] = filters[key];
        }
        return acc;
    }, {});

    // 3. Build where clause
    const filterKeys = Object.keys(safeFilters);
    if (filterKeys.length > 0) {
        const clauses = filterKeys.map(key => {
            values.push(`%${safeFilters[key]}%`);
            return `${key} LIKE ?`;
        });
        whereClause = 'WHERE ' + clauses.join(' AND ');
    }

    const query = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    const [rows] = await db.query(query, values);
    return rows[0].total;
};

module.exports = {
    getTableCount
};
