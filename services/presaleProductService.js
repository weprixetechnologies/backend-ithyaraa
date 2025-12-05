const presaleProductModel = require('../model/presaleProductModel');

// Helper function to safely parse JSON
const safeParse = (value) => {
    try {
        return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
        return value;
    }
};

// Get all presale products with pagination
const getAllPresaleProductsPaginated = async (page = 1, limit = 5) => {
    try {
        // Convert page and limit to numbers
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 5;
        const offset = (pageNum - 1) * limitNum;

        // Get total count and paginated products
        const [total, products] = await Promise.all([
            presaleProductModel.getPresaleProductsCount(),
            presaleProductModel.getPresaleProductsPaginated(limitNum, offset)
        ]);

        // Parse featuredImage for each product
        const parsedProducts = products.map((product) => {
            const parsed = { ...product };
            if (parsed.featuredImage) {
                parsed.featuredImage = safeParse(parsed.featuredImage);
            }
            return parsed;
        });

        const totalPages = Math.ceil(total / limitNum);

        return {
            products: parsedProducts,
            pagination: {
                currentPage: pageNum,
                totalPages: totalPages,
                totalItems: total,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPreviousPage: pageNum > 1
            }
        };
    } catch (error) {
        console.error('Error in getAllPresaleProductsPaginated service:', error);
        throw error;
    }
};

module.exports = {
    getAllPresaleProductsPaginated
};

