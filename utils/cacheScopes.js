/**
 * Cache key scopes
 *
 * RULES:
 * - No Redis calls
 * - No JSON/stringify logic
 * - No "cache:" prefix
 */

const { buildPaginatedKey } = require('./cacheKeyUtils');

const SCOPE = {
  // ========== PRODUCTS ==========
  PRODUCTS_ALL: 'cache:products:all',

  PRODUCTS_PAGE: (page, limit, filters = {}) =>
    buildPaginatedKey('products:page', page, limit, filters),

  PRODUCT_DETAIL: (productID) =>
    `cache:products:detail:${productID}`,

  // ========== SHOP / PUBLIC ==========
  SHOP_PRODUCTS_PAGE: (page, limit, filters = {}) =>
    buildPaginatedKey('shop:products', page, limit, filters),

  // ========== CATEGORIES ==========
  CATEGORIES_ALL: 'cache:categories:all',
  CATEGORY_DETAIL: (categoryID) => `cache:categories:detail:${categoryID}`,

  // ========== OFFERS ==========
  OFFERS_ALL: 'cache:offers:all',
  OFFERS_LIST: 'cache:offers:list',
  OFFER_ACTIVE: (offerID) => `cache:offers:active:${offerID}`,

  // ========== FLASH SALES ==========
  FLASH_ACTIVE: (productID) => `cache:flash:active:${productID}`,

  // ========== HOMEPAGE ==========
  // Top-level home data (used by section-items/home API)
  HOME_DATA: 'cache:home:data',
};

module.exports = { SCOPE };
