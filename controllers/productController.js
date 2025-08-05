const model = require('./../model/productModel');
const imageModel = require('./../model/imagesModel')
const imageService = require('./../services/imageService')
const service = require('./../services/productServices');

const addProduct = async (req, res) => {
    try {
        const payload = req.body;
    console.log(payload);

        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({ message: 'Invalid payload' });
        }

        // 1. Generate Unique Product ID
        const productID = await service.generateUniqueProductID();
        if (!productID) {
            return res.status(500).json({ message: 'Failed to generate product ID' });
        }

        // 2. Upload Gallery Images
        const galleryImages = payload.galleryImage;
        if (galleryImages != null) {
            if (!Array.isArray(galleryImages)) {
                return res.status(400).json({ message: '`galleryImages` must be an array or null' });
            }

            if (galleryImages.length > 0) {
                const uploadImagesResult = await imageService.uploadImageMap({
                    imageArray: galleryImages,
                    identity: productID
                });

                if (!uploadImagesResult.success) {
                    return res.status(500).json({
                        message: 'Gallery image upload failed',
                        error: uploadImagesResult.error || 'Unknown image error'
                    });
                }
            }
        }

        // 3. Upload Featured Images
        const featuredImage = payload.featuredImage;
       
        // 4. Upload Product Core Data
        const uploadProduct = await model.uploadProduct({ ...payload, productID });
        if (!uploadProduct.success) {
            return res.status(500).json({
                message: 'Product upload failed',
                error: uploadProduct.error
            });
        }

        // 5. Upload Attributes (optional)
        const attributes = payload.attributes;

        console.log("Starting attribute upload...");
        
        if (attributes && Array.isArray(attributes) && attributes.length > 0) {
            console.log("Attributes received:", attributes);
        
            try {
                console.log("Calling uploadAttributeService...");
                const attributesResult = await service.uploadAttributeService(attributes);
        
                console.log("uploadAttributeService response:", attributesResult);
        
                if (!attributesResult.success) {
                    console.error("Attribute upload failed:", attributesResult.data || attributesResult.message);
                    return res.status(500).json({
                        message: 'Attribute upload failed',
                        error: attributesResult.data || attributesResult.message
                    });
                }
        
                console.log("Attribute upload successful.");
            } catch (err) {
                console.error("Error during attribute upload:", err);
                return res.status(500).json({
                    message: 'Attribute upload failed due to an exception',
                    error: err.message
                });
            }
        } else {
            console.log("No attributes to upload.");
        }
        

        // 6. Upload Variations (optional)
        const variations = payload.productVariations;

        console.log('Step: Checking variations in payload');
        if (variations) {
            console.log('Step: Variations found in payload:', JSON.stringify(variations, null, 2));
        
            try {
                console.log('Step: Calling uploadVariationMap service');
                const variationsResult = await service.uploadVariationMap({ variations, productID });
        
                console.log('Step: uploadVariationMap response:', JSON.stringify(variationsResult, null, 2));
        
                if (!variationsResult.success) {
                    console.error('Step: Variation upload failed:', variationsResult.error);
                    return res.status(500).json({
                        message: 'Variation upload failed',
                        error: variationsResult.error
                    });
                }
        
                console.log('Step: Variation upload successful');
            } catch (err) {
                console.error('Step: uploadVariationMap threw an exception:', err);
                return res.status(500).json({
                    message: 'Variation upload service error',
                    error: err.message
                });
            }
        } else {
            console.log('Step: No variations provided in payload');
        }
        

        // ✅ 7. Success Response
        return res.status(201).json({
            success: true,
            message: 'Product uploaded successfully',
            productID
        });

    } catch (err) {
        console.error('Error in addProduct:', err);
        return res.status(500).json({
            message: 'Internal server error',
            error: err.message || 'Unknown server error'
        });
    }
};

const editProduct = async (req, res) => {
    try {
        const payload = req.body;
        const productID = payload.productID;

        if (!payload || typeof payload !== 'object' || !productID) {
            return res.status(400).json({ message: 'Invalid payload or missing productID' });
        }

        // 1. Upload Gallery Images (if any)
        const galleryImages = payload.galleryImage;
        if (galleryImages != null) {
            if (!Array.isArray(galleryImages)) {
                return res.status(400).json({ message: '`galleryImage` must be an array or null' });
            }

            if (galleryImages.length > 0) {
                const uploadImagesResult = await imageService.editImageMap({
                    imageArray: galleryImages,
                    identity: productID
                });

                if (!uploadImagesResult.success) {
                    return res.status(500).json({
                        message: 'Gallery image upload failed',
                        error: uploadImagesResult.error || 'Unknown image error'
                    });
                }
            }
        }

        // 2. Upload Featured Images (if any)
        const featuredImage = payload.featuredImage;
        if (featuredImage != null) {
            if (!Array.isArray(featuredImage)) {
                return res.status(400).json({ message: '`featuredImage` must be an array or null' });
            }

            if (featuredImage.length > 0) {
                const uploadImagesResult = await imageService.editImageMap({
                    imageArray: featuredImage,
                    identity: productID
                });

                if (!uploadImagesResult.success) {
                    return res.status(500).json({
                        message: 'Featured image upload failed',
                        error: uploadImagesResult.error || 'Unknown image error'
                    });
                }
            }
        }

        // 3. Update Product Core Info
        const updateProduct = await model.editProductModel({ ...payload, productID });
        if (!updateProduct.success) {
            return res.status(500).json({
                message: 'Product update failed',
                error: updateProduct.error
            });
        }

        // 4. Replace Attributes (if any)
        const attributes = payload.attributes;
        if (Array.isArray(attributes) && attributes.length > 0) {
            const attrResult = await service.editAttributeService(attributes, productID);
            if (!attrResult.success) {
                return res.status(500).json({
                    message: 'Attribute update failed',
                    error: attrResult.error
                });
            }
        }

        // 5. Replace Variations (if any)
        const variations = payload.productVariations;
        if (Array.isArray(variations) && variations.length > 0) {
            const varResult = await service.editVariationMap({ variations, productID });
            if (!varResult.success) {
                return res.status(500).json({
                    message: 'Variation update failed',
                    error: varResult.error
                });
            }
        }

        // ✅ 6. Final Success Response
        return res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            productID
        });

    } catch (err) {
        console.error('Error in editProduct:', err);
        return res.status(500).json({
            message: 'Internal server error',
            error: err.message || 'Unknown error'
        });
    }
};

const getPaginatedProducts = async (req, res) => {
    try {
      const result = await service.fetchPaginatedProducts(req.query);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('Error getting products:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
};
  
const getProductPageCount = async (req, res) => {
    try {
      const result = await service.getProductCount(req.query);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('Error getting Page Count:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
};
const getProductDetails = async (req, res) => {
    const { productID } = req.params;

    if (!productID) {
        return res.status(400).json({ message: 'Missing productID' });
    }

    try {
        const product = await service.getProductDetails(productID);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        return res.status(200).json({ success: true, product });
    } catch (error) {
        console.error('Error fetching product details:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};


module.exports = { addProduct, getPaginatedProducts, getProductPageCount , getProductDetails,editProduct};


//payload

// {
//     "name": "Slim Fit Cotton T-Shirt",
//     "description": "A soft and comfortable cotton t-shirt, perfect for everyday wear.",
//     "regularPrice": 599.00,
//     "salePrice": 499.00,
//     "discountType": "flat",
//     "discountValue": 100,
//     "type": "clothing",
//     "categoryName": "T-Shirts",
//     "categoryID": "CAT1001",
//     "status": "active",
//     "offerID": "OFF2025",
//     "overridePrice": false,
//     "tab1": "Fabric: 100% Cotton",
//     "tab2": "Washing Instructions: Machine Wash",
  
//     "featuredImage": [{
//       "imgUrl": "https://cdn.mystore.com/images/prod12345-featured.jpg",
//       "imgAlt": "Slim fit cotton t-shirt featured image"
//     },]
  
//     "galleryImages": [
//       {
//         "imgUrl": "https://cdn.mystore.com/images/prod12345-front.jpg",
//         "imgAlt": "Front view of blue t-shirt"
//       },
//       {
//         "imgUrl": "https://cdn.mystore.com/images/prod12345-back.jpg",
//         "imgAlt": "Back view of blue t-shirt"
//       }
//     ],
  
//     "variations": [
//       {
//         "variationName": "Color - Blue / Size - M",
//         "variationSlug": "color-blue-size-m",
//         "variationID": "VAR0001",
//         "variationPrice": 499.00,
//         "variationStock": 50,
//         "variationValues": {
//           "color": "Blue",
//           "size": "M"
//         }
//       },
//       {
//         "variationName": "Color - Blue / Size - L",
//         "variationSlug": "color-blue-size-l",
//         "variationID": "VAR0002",
//         "variationPrice": 499.00,
//         "variationStock": 40,
//         "variationValues": {
//           "color": "Blue",
//           "size": "L"
//         }
//       }
//     ]
//   }
  