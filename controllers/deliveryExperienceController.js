const feedbackModel = require('../model/deliveryExperienceModel');

const submitFeedback = async (req, res) => {
    try {
        const { orderID, rating, comment, tags } = req.body;
        const userID = req.user.uid;

        if (!orderID || !rating) {
            return res.status(400).json({ success: false, message: 'Order ID and rating are required' });
        }

        // Check if feedback already exists for this order
        const existing = await feedbackModel.getFeedbackByOrderID(orderID);
        if (existing) {
            return res.status(400).json({ success: false, message: 'Feedback already submitted for this order' });
        }

        const feedbackID = await feedbackModel.addFeedback({
            orderID,
            userID,
            rating,
            comment,
            tags: Array.isArray(tags) ? tags.join(',') : tags
        });

        res.status(201).json({ success: true, message: 'Thank you for your feedback!', feedbackID });
    } catch (error) {
        console.error('Error in submitFeedback controller:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const listFeedback = async (req, res) => {
    try {
        const feedback = await feedbackModel.getAllFeedback();
        res.status(200).json({ success: true, data: feedback });
    } catch (error) {
        console.error('Error in listFeedback controller:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    submitFeedback,
    listFeedback
};
