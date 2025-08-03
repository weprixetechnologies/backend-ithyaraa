const db = require('./../utils/dbconnect')

const uploadImage = async ({ imgUrl, imgAlt, identity }) => {
    const query = `
        INSERT INTO images (imgUrl, imgAlt, identity)
        VALUES (?, ?, ?)
    `;

    try {
        const [result] = await db.query(query, [imgUrl, imgAlt, identity]);

        return {
            success: true,
            message: 'Image uploaded successfully',
            insertedId: result.insertId
        };
    } catch (error) {
        console.error('Error uploading image:', error);
        return {
            success: false,
            message: 'Failed to upload image',
            error: error.message
        };
    }
};

module.exports = { uploadImage }