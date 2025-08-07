const model = require('./../model/offersModel')
const offerService = require('./../services/offerService')

const fetchOfferbyName = async (req, res) => {
    try {
        const { name } = req.query;

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ message: 'Invalid or missing offer name' });
        }

        const search = await model.findOffersByName(name);
        console.log(search);


        res.status(200).json({
            message: 'Fetch Successful',
            result: search
        });
    } catch (error) {
        console.error('Error fetching offer by name:', error);
        res.status(500).json({
            message: 'Server error while fetching offer',
            error: error.message
        });
    }
};



const postOfferController = async (req, res) => {
    try {
        const offerData = req.body;

        const result = await offerService.createOffer(offerData);

        res.status(201).json(result);
    } catch (err) {
        console.error('Error in postOfferController:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

const getOffers = async (req, res) => {
    try {
        const offers = await offerService.fetchFilteredOffers(req.query);
        return res.json({
            success: true,
            count: offers.length,
            data: offers
        });
    } catch (err) {
        console.error('Error fetching offers:', err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
const getOfferCount = async (req, res) => {
    try {
        const count = await offerService.fetchOfferCount(req.query);
        res.json({ total: count });
    } catch (error) {
        console.error('Error fetching offer count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const editOffer = async (req, res) => {
    try {
        const { offerID } = req.params;
        const updatedData = req.body;

        if (!offerID) {
            return res.status(400).json({ success: false, message: 'offerID param is required' });
        }

        const result = await offerService.updateOffer(offerID, updatedData);

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Error editing offer:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
const getOfferDetails = async (req, res) => {
    const { offerID } = req.params;

    try {
        const offer = await offerService.fetchOfferDetails(offerID);
        res.status(200).json({
            success: true,
            data: offer,
        });
    } catch (error) {
        console.error('Error fetching offer details:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};


module.exports = { fetchOfferbyName, postOfferController, getOffers, getOfferCount, editOffer, getOfferDetails };
