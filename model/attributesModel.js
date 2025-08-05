const db = require('./../utils/dbconnect')

// 🔍 Search attributes by partial name
const searchByName = async (name) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM attributes WHERE name LIKE ?',
            [`%${name}%`]
        );
        return rows;
    } catch (error) {
        console.error('searchByName error:', error);
        throw error;
    }
};
const deleteAttributesByProductID = async (productID) => {
    return db.query(`DELETE FROM attributes WHERE productID = ?`, [productID]);
};

// ⬆️ Insert a new attribute with JSON values
const uploadAttribute = async ({ name, values }) => {
    try {
        // 1. Check if attribute with the name already exists
        const [existingRows] = await db.query(
            'SELECT * FROM attributes WHERE name = ?',
            [name]
        );

        if (existingRows.length > 0) {
            const existingAttr = existingRows[0];
            const existingValues = JSON.parse(existingAttr.value || '[]');

            // 2. Merge unique new values
            const newUniqueValues = values.filter(
                (val) => !existingValues.includes(val)
            );

            if (newUniqueValues.length === 0) {
                return {
                    success: true,
                    message: 'No new values to update',
                    attributeId: existingAttr.id
                };
            }

            const mergedValues = [...existingValues, ...newUniqueValues];

            // 3. Update the attribute with merged values
            await db.query(
                'UPDATE attributes SET value = ? WHERE id = ?',
                [JSON.stringify(mergedValues), existingAttr.id]
            );

            return {
                success: true,
                updated: true,
                addedValues: newUniqueValues,
                attributeId: existingAttr.id
            };
        } else {
            // 4. Insert new attribute if name not found
            const [result] = await db.query(
                'INSERT INTO attributes (name, value) VALUES (?, ?)',
                [name, JSON.stringify(values)]
            );

            return {
                success: true,
                inserted: true,
                insertedId: result.insertId
            };
        }

    } catch (error) {
        console.error('uploadAttribute error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};


module.exports = {
    searchByName,
    uploadAttribute, deleteAttributesByProductID
};