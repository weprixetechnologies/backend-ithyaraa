const presaleProductModel = require('../model/presaleProductModel');
const presaleProductService = require('../services/presaleProductService');
const { randomUUID } = require('crypto');
const db = require('../utils/dbconnect');

// Create presale product
const createPresaleProductController = async (req, res) => {
    try {
        const productData = req.body;

        // Generate presaleProductID if not provided
        if (!productData.presaleProductID) {
            productData.presaleProductID = `PRESALE_${randomUUID().substring(0, 8).toUpperCase()}`;
        }

        const result = await presaleProductModel.createPresaleProduct(productData);

        res.status(201).json({
            success: true,
            message: result.message,
            data: { presaleProductID: productData.presaleProductID }
        });
    } catch (error) {
        console.error('Error creating presale product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create presale product',
            error: error.message
        });
    }
};

// Get all presale products
const getAllPresaleProductsController = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            brandID: req.query.brandID
        };

        const products = await presaleProductModel.getAllPresaleProducts(filters);

        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        console.error('Error fetching presale products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch presale products',
            error: error.message
        });
    }
};

// Get all presale products with pagination
const getAllPresaleProductsPaginatedController = async (req, res) => {
    try {
        const page = req.query.page || 1;
        const limit = req.query.limit || 5;

        const result = await presaleProductService.getAllPresaleProductsPaginated(page, limit);

        res.status(200).json({
            success: true,
            data: result.products,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Error fetching paginated presale products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch presale products',
            error: error.message
        });
    }
};

// Get presale product by ID
const getPresaleProductByIDController = async (req, res) => {
    try {
        const { presaleProductID } = req.params;
        const product = await presaleProductModel.getPresaleProductByID(presaleProductID);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Presale product not found'
            });
        }

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error('Error fetching presale product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch presale product',
            error: error.message
        });
    }
};

// Update presale product
const updatePresaleProductController = async (req, res) => {
    try {
        const { presaleProductID } = req.params;
        const updateData = req.body;

        const result = await presaleProductModel.updatePresaleProduct(presaleProductID, updateData);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message
            });
        }

        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Error updating presale product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update presale product',
            error: error.message
        });
    }
};

// Delete presale product
const deletePresaleProductController = async (req, res) => {
    try {
        const { presaleProductID } = req.params;
        const result = await presaleProductModel.deletePresaleProduct(presaleProductID);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message
            });
        }

        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Error deleting presale product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete presale product',
            error: error.message
        });
    }
};

module.exports = {
    createPresaleProductController,
    getAllPresaleProductsController,
    getAllPresaleProductsPaginatedController,
    getPresaleProductByIDController,
    updatePresaleProductController,
    deletePresaleProductController
};

