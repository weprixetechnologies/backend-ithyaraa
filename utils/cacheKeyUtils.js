const crypto = require('crypto');

/**
 * Cache key utility helpers
 */

/**
 * Normalize filters:
 * - Remove undefined / null / empty values
 * - Convert everything to string-safe values
 */
function normalizeFilters(filters = {}) {
    const normalized = {};

    Object.keys(filters)
        .sort()
        .forEach((key) => {
            const value = filters[key];
            if (
                value !== undefined &&
                value !== null &&
                value !== ''
            ) {
                normalized[key] = String(value);
            }
        });

    return normalized;
}

/**
 * Stable stringify:
 * - Sorts keys before JSON stringify
 * - Guarantees same object → same string
 */
function stableStringify(obj = {}) {
    return JSON.stringify(
        Object.keys(obj)
            .sort()
            .reduce((acc, key) => {
                acc[key] = obj[key];
                return acc;
            }, {})
    );
}

/**
 * MD5 Hash of an object
 */
function hashObject(obj = {}) {
    const str = stableStringify(obj);
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 10);
}

/**
 * Build paginated cache key safely
 * Pattern: cache:{scope}:{page}:{limit}:{hash}
 */
function buildPaginatedKey(scope, page, limit, filters = {}) {
    const cleanFilters = normalizeFilters(filters);
    const filterHash = hashObject(cleanFilters);

    // Prepend 'cache:' if not already present
    const cleanScope = scope.startsWith('cache:') ? scope : `cache:${scope}`;
    return `${cleanScope}:${page}:${limit}:${filterHash}`;
}

module.exports = {
    normalizeFilters,
    stableStringify,
    hashObject,
    buildPaginatedKey,
};
