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
  PRODUCTS_ALL: 'products:all',

  PRODUCTS_PAGE: (page, limit, filters = {}) =>
    buildPaginatedKey('products:page', page, limit, filters),

  PRODUCT_DETAIL: (productID) =>
    `products:detail:${productID}`,

  // ========== SHOP / PUBLIC ==========
  SHOP_PRODUCTS_PAGE: (page, limit, filters = {}) =>
    buildPaginatedKey('shop:products', page, limit, filters),

  // ========== CATEGORIES ==========
  CATEGORIES_ALL: 'categories:all',

  // ========== OFFERS ==========
  OFFERS_ALL: 'offers:all',

  // ========== HOMEPAGE ==========
  HOMEPAGE: 'homepage:data',
  // Top-level home data (used by section-items/home API)
  HOME_DATA: 'home:data',
};

module.exports = { SCOPE };
