const model = require('./../model/productModel');
const imageModel = require('./../model/imagesModel')
const imageService = require('./../services/imageService')
const service = require('./../services/productServices');

const addProduct = async (req, res) => {
    try {
        const payload = req.body;

        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({ message: 'Invalid payload' });
        }

        // 1. Generate Unique Product ID
        const productID = await service.generateUniqueProductID();
        if (!productID) {
            return res.status(500).json({ message: 'Failed to generate product ID' });
        }

        // 2. Validate and Upload Gallery Images
        const galleryImages = payload.galleryImages;

        if (galleryImages !== null && galleryImages !== undefined) {
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
                        message: 'Image upload failed',
                        error: uploadImagesResult.error || 'Unknown image error'
                    });
                }
            }
        }

        const featuredImage = payload.featuredImage;

        if (featuredImage !== null && featuredImage !== undefined) {
            if (!Array.isArray(featuredImage)) {
                return res.status(400).json({ message: '`featuredImage` must be an array or null' });
            }

            if (featuredImage.length > 0) {
                const uploadImagesResult = await imageService.uploadImageMap({
                    imageArray: featuredImage,
                    identity: productID
                });

                if (!uploadImagesResult.success) {
                    return res.status(500).json({
                        message: 'Image upload failed',
                        error: uploadImagesResult.error || 'Unknown image error'
                    });
                }
            }
        }

        // 3. Upload Product
        const uploadProduct = await model.uploadProduct({ ...payload, productID });
        if (!uploadProduct.success) {
            return res.status(500).json({
                message: 'Product upload failed',
                error: uploadProduct.error
            });
        }

        // 4. Upload Variations
        const variations = payload.variations;
        if (variations) {
            const variationsResult = await service.uploadVariationMap({ variations, productID });

            if (!variationsResult.success) {
                return res.status(500).json({
                    message: 'Variation upload failed',
                    error: variationsResult.error
                });
            }
        }

        // ✅ 5. Success Response
        return res.status(201).json({
            success: true,
            message: 'Product, variations, and images uploaded successfully',
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




module.exports = { addProduct };


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
  