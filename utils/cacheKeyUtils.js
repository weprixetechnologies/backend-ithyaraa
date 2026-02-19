/**
 * Cache key utility helpers
 *
 * PURPOSE:
 * - Ensure consistent cache keys
 * - Avoid duplicate cache entries due to object order
 * - Centralize all key-building logic
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
 * Build paginated cache key safely
 */
function buildPaginatedKey(scope, page, limit, filters = {}) {
    const cleanFilters = normalizeFilters(filters);
    const filterHash = stableStringify(cleanFilters);

    return `${scope}:${page}:${limit}:${filterHash}`;
}

module.exports = {
    normalizeFilters,
    stableStringify,
    buildPaginatedKey,
};
