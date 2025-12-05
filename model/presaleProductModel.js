const db = require('../utils/dbconnect');
const { randomUUID } = require('crypto');

// Helper: convert various date inputs (including ISO) to MySQL DATETIME
function toMySQLDateTime(value) {
    if (!value) return null;
    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return null;
        // Format: YYYY-MM-DD HH:MM:SS
        return date.toISOString().slice(0, 19).replace('T', ' ');
    } catch {
        return null;
    }
}

// Helper: convert to MySQL DATE (YYYY-MM-DD)
function toMySQLDate(value) {
    if (!value) return null;
    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().slice(0, 10);
    } catch {
        return null;
    }
}

// Create presale product
const createPresaleProduct = async (productData) => {
    try {
        const {
            presaleProductID,
            name,
            description,
            regularPrice,
            salePrice,
            discountType,
            discountValue,
            type = 'variable',
            status = 'active',
            offerID,
            overridePrice,
            tab1,
            tab2,
            featuredImage,
            productAttributes,
            categories,
            brand,
            galleryImage,
            brandID,
            custom_inputs,
            allowCustomerImageUpload = 0,
            expectedDeliveryDate,
            minOrderQuantity = 1,
            maxOrderQuantity,
            totalAvailableQuantity,
            reservedQuantity = 0,
            preSaleStartDate,
            preSaleEndDate,
            earlyBirdDiscount,
            earlyBirdEndDate
        } = productData;

        const query = `
            INSERT INTO presale_products (
                presaleProductID, name, description, regularPrice, salePrice,
                discountType, discountValue, type, status, offerID, overridePrice,
                tab1, tab2, featuredImage, productAttributes, categories,
                brand, galleryImage, brandID, custom_inputs, allowCustomerImageUpload,
                expectedDeliveryDate, minOrderQuantity, maxOrderQuantity,
                totalAvailableQuantity, reservedQuantity, preSaleStartDate,
                preSaleEndDate, earlyBirdDiscount, earlyBirdEndDate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            presaleProductID,
            name,
            description || null,
            regularPrice,
            salePrice || null,
            discountType || null,
            discountValue || null,
            type,
            status,
            offerID || null,
            overridePrice || null,
            tab1 || null,
            tab2 || null,
            featuredImage ? JSON.stringify(featuredImage) : null,
            productAttributes ? JSON.stringify(productAttributes) : null,
            categories ? JSON.stringify(categories) : null,
            brand || null,
            galleryImage ? JSON.stringify(galleryImage) : null,
            brandID || null,
            custom_inputs ? JSON.stringify(custom_inputs) : null,
            allowCustomerImageUpload ? 1 : 0,
            toMySQLDate(expectedDeliveryDate),
            minOrderQuantity,
            maxOrderQuantity || null,
            totalAvailableQuantity || null,
            reservedQuantity,
            toMySQLDateTime(preSaleStartDate),
            toMySQLDateTime(preSaleEndDate),
            earlyBirdDiscount || null,
            toMySQLDateTime(earlyBirdEndDate)
        ];

        const [result] = await db.query(query, values);
        return {
            success: true,
            message: 'Presale product created successfully',
            id: result.insertId
        };
    } catch (error) {
        console.error('Error creating presale product:', error);
        throw error;
    }
};

// Get all presale products
const getAllPresaleProducts = async (filters = {}) => {
    try {
        let whereConditions = [];
        let queryParams = [];

        if (filters.status) {
            whereConditions.push('status = ?');
            queryParams.push(filters.status);
        }

        if (filters.brandID) {
            whereConditions.push('brandID = ?');
            queryParams.push(filters.brandID);
        }

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        const query = `
            SELECT * FROM presale_products 
            ${whereClause}
            ORDER BY createdAt DESC
        `;

        const [rows] = await db.query(query, queryParams);
        return rows;
    } catch (error) {
        console.error('Error fetching presale products:', error);
        throw error;
    }
};

// Get total count of presale products
const getPresaleProductsCount = async () => {
    try {
        const [countResult] = await db.query(
            'SELECT COUNT(*) as total FROM presale_products'
        );
        return countResult[0].total;
    } catch (error) {
        console.error('Error fetching presale products count:', error);
        throw error;
    }
};

// Get presale products with limit and offset (only specific fields)
const getPresaleProductsPaginated = async (limit, offset) => {
    try {
        const query = `
            SELECT 
                presaleProductID,
                name,
                regularPrice,
                salePrice,
                discountType,
                discountValue,
                status,
                featuredImage,
                brand,
                preSaleEndDate
            FROM presale_products 
            ORDER BY createdAt DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.query(query, [limit, offset]);
        return rows;
    } catch (error) {
        console.error('Error fetching paginated presale products:', error);
        throw error;
    }
};

// Get presale product by ID
const getPresaleProductByID = async (presaleProductID) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM presale_products WHERE presaleProductID = ?',
            [presaleProductID]
        );
        return rows[0] || null;
    } catch (error) {
        console.error('Error fetching presale product:', error);
        throw error;
    }
};

// Update presale product
const updatePresaleProduct = async (presaleProductID, productData) => {
    try {
        const updateFields = [];
        const values = [];

        // Fields that should NOT be updated
        const excludedFields = [
            'presaleProductID',
            'id',
            'createdAt',
            'updatedAt',
            'attributes'  // This column doesn't exist in the table
        ];

        Object.keys(productData).forEach(key => {
            // Skip excluded fields
            if (!excludedFields.includes(key) && productData[key] !== undefined) {
                if (['featuredImage', 'productAttributes', 'categories', 'galleryImage', 'custom_inputs'].includes(key)) {
                    updateFields.push(`${key} = ?`);
                    // Handle null or empty values for JSON fields
                    if (productData[key] === null || productData[key] === '') {
                        values.push(null);
                    } else {
                        values.push(JSON.stringify(productData[key]));
                    }
                } else if (key === 'allowCustomerImageUpload') {
                    updateFields.push(`${key} = ?`);
                    values.push(productData[key] ? 1 : 0);
                } else if (['preSaleStartDate', 'preSaleEndDate', 'earlyBirdEndDate'].includes(key)) {
                    // Convert DATETIME fields
                    updateFields.push(`${key} = ?`);
                    values.push(toMySQLDateTime(productData[key]));
                } else if (key === 'expectedDeliveryDate') {
                    // Convert DATE field
                    updateFields.push(`${key} = ?`);
                    values.push(toMySQLDate(productData[key]));
                } else {
                    updateFields.push(`${key} = ?`);
                    // Handle null values properly
                    values.push(productData[key] === '' ? null : productData[key]);
                }
            }
        });

        if (updateFields.length === 0) {
            return { success: false, message: 'No fields to update' };
        }

        values.push(presaleProductID);

        const query = `
            UPDATE presale_products 
            SET ${updateFields.join(', ')}, updatedAt = NOW()
            WHERE presaleProductID = ?
        `;

        const [result] = await db.query(query, values);
        return {
            success: result.affectedRows > 0,
            message: result.affectedRows > 0 ? 'Presale product updated successfully' : 'No changes made'
        };
    } catch (error) {
        console.error('Error updating presale product:', error);
        throw error;
    }
};

// Delete presale product
const deletePresaleProduct = async (presaleProductID) => {
    try {
        const [result] = await db.query(
            'DELETE FROM presale_products WHERE presaleProductID = ?',
            [presaleProductID]
        );
        return {
            success: result.affectedRows > 0,
            message: result.affectedRows > 0 ? 'Presale product deleted successfully' : 'Product not found'
        };
    } catch (error) {
        console.error('Error deleting presale product:', error);
        throw error;
    }
};

module.exports = {
    createPresaleProduct,
    getAllPresaleProducts,
    getPresaleProductsCount,
    getPresaleProductsPaginated,
    getPresaleProductByID,
    updatePresaleProduct,
    deletePresaleProduct
};

