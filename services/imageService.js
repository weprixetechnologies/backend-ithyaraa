const imageModel = require('./../model/imagesModel')

const uploadImageMap = async ({ imageArray, identity }) => {
    if (!Array.isArray(imageArray) || imageArray.length === 0) {
        return {
            success: false,
            message: 'Image array is empty or invalid'
        };
    }

    try {
        const uploadResults = [];

        for (const image of imageArray) {
            const { imgUrl, imgAlt } = image;

            const result = await imageModel.uploadImage({ imgUrl, imgAlt, identity });

            if (!result.success) {
                return {
                    success: false,
                    message: 'Failed to upload one or more images',
                    error: result.error
                };
            }

            uploadResults.push(result);
        }

        return {
            success: true,
            message: 'All images uploaded successfully',
            count: uploadResults.length,
            data: uploadResults
        };
    } catch (error) {
        console.error('uploadImageMap error:', error);
        return {
            success: false,
            message: 'Unexpected error during image map upload',
            error: error.message
        };
    }
};

const editImageMap = async ({ imageArray, identity }) => {
    if (!Array.isArray(imageArray) || imageArray.length === 0) {
        return {
            success: false,
            message: 'Image array is empty or invalid'
        };
    }

    try {
        const uploadResults = [];

        for (const image of imageArray) {
            const { imgUrl, imgAlt } = image;

            const result = await imageModel.uploadImage({ imgUrl, imgAlt, identity });

            if (!result.success) {
                return {
                    success: false,
                    message: 'Failed to upload one or more images',
                    error: result.error
                };
            }

            uploadResults.push(result);
        }

        return {
            success: true,
            message: 'All images uploaded successfully',
            count: uploadResults.length,
            data: uploadResults
        };
    } catch (error) {
        console.error('editImageMap error:', error);
        return {
            success: false,
            message: 'Unexpected error during image map upload',
            error: error.message
        };
    }
};


module.exports = { uploadImageMap, editImageMap }