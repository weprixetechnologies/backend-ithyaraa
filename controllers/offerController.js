const model = require('../model/offerSectionItemsModel');
const { getCache, setCache, deleteCache } = require('../utils/cacheHelper');
const { SCOPE } = require('../utils/cacheScopes');

const getOfferPageFeed = async (req, res) => {
  try {
    const revalidate = req.query.revalidate === 'true';

    if (revalidate) {
      console.log('Force revalidate requested. Deleting offer page cache...');
      try {
        await deleteCache(SCOPE.OFFER_PAGE_DATA);
      } catch (e) {
        console.error('Failed to clear offer page cache during revalidate', e);
      }
    } else {
      // Check cache first
      try {
        const cached = await getCache(SCOPE.OFFER_PAGE_DATA);
        if (cached) {
          console.log('Serving offer page feed from Redis cache');
          return res.status(200).json({ success: true, fromCache: true, data: cached });
        }
      } catch (e) {
        console.error('Cache read error in getOfferPageFeed', e);
      }
    }

    // Load from database
    console.log('Fetching offer page feed from database...');
    const result = await model.listItems();
    if (!result.success) {
      return res.status(500).json(result);
    }

    // Attach top-level titles for convenience
    if (Array.isArray(result.data)) {
      result.data = result.data.map(item => {
        const title = item.section?.title || item.group?.title || item.title || null;
        return { ...item, title };
      });
    }

    // Cache the response
    try {
      await setCache(SCOPE.OFFER_PAGE_DATA, result.data);
    } catch (e) {
      console.error('Cache set error in getOfferPageFeed', e);
    }

    return res.status(200).json({ success: true, fromCache: false, data: result.data });
  } catch (error) {
    console.error('offerController.getOfferPageFeed error', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  getOfferPageFeed
};
