const presaleProductModel = require('../model/presaleProductModel');
const presaleProductService = require('../services/presaleProductService');
const productService = require('../services/productServices');
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

        const presaleProductID = productData.presaleProductID;

        // Create the main product
        const result = await presaleProductModel.createPresaleProduct(productData);

        // Handle variations if provided
        // Note: presaleProductID is used as productID in the variations table
        const variations = productData.productVariations || productData.variations;
        if (variations && Array.isArray(variations) && variations.length > 0) {
            try {
                const variationsResult = await productService.uploadVariationMap({ 
                    variations, 
                    productID: presaleProductID 
                });
                
                if (!variationsResult.success) {
                    console.error('Variation upload failed:', variationsResult.error);
                    // Don't fail the entire request, but log the error
                    // You can choose to return an error here if needed
                }
            } catch (varError) {
                console.error('Error uploading variations:', varError);
                // Don't fail the entire request, but log the error
            }
        }

        res.status(201).json({
            success: true,
            message: result.message,
            data: { presaleProductID }
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

// Search presale products (returns only name and ID)
const searchPresaleProductsController = async (req, res) => {
    try {
        const { search } = req.query;
        const products = await presaleProductModel.searchPresaleProducts(search);

        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        console.error('Error searching presale products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search presale products',
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

        // Update the main product data (excluding variations)
        const result = await presaleProductModel.updatePresaleProduct(presaleProductID, updateData);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message
            });
        }

        // Handle variations if provided
        // Note: presaleProductID is used as productID in the variations table
        const variations = updateData.productVariations || updateData.variations;
        if (variations && Array.isArray(variations) && variations.length > 0) {
            try {
                const varResult = await productService.editVariationMap({ 
                    variations, 
                    productID: presaleProductID 
                });
                
                if (!varResult.success) {
                    console.error('Variation update failed:', varResult.error);
                    // Don't fail the entire request, but log the error
                    // You can choose to return an error here if needed
                }
            } catch (varError) {
                console.error('Error updating variations:', varError);
                // Don't fail the entire request, but log the error
            }
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

// Bulk delete presale products
const bulkDeletePresaleProductsController = async (req, res) => {
    try {
        const { presaleProductIDs } = req.body;

        if (!Array.isArray(presaleProductIDs) || presaleProductIDs.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'presaleProductIDs must be a non-empty array'
            });
        }

        const result = await presaleProductModel.bulkDeletePresaleProducts(presaleProductIDs);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        res.status(200).json({
            success: true,
            message: result.message,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error bulk deleting presale products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to bulk delete presale products',
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
    deletePresaleProductController,
    bulkDeletePresaleProductsController,
    searchPresaleProductsController
};

