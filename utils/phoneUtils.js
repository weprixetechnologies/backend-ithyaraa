/**
 * Normalizes an Indian phone number to +91XXXXXXXXXX format.
 * - Removes all non-digit characters.
 * - If 10 digits, adds +91.
 * - If 12 digits and starts with 91, replaces with +91.
 * - If it already starts with +91, ensures it's cleaned up.
 * 
 * @param {string|number} phone The phone number to normalize.
 * @returns {string} Normalized phone number (+91XXXXXXXXXX).
 */
const normalizePhoneNumber = (phone) => {
    if (!phone) return "";
    
    // Convert to string and remove all non-digits
    let cleaned = phone.toString().replace(/\D/g, "");
    
    // If it's 10 digits, it's a local number, add +91
    if (cleaned.length === 10) {
        return `+91${cleaned}`;
    }
    
    // If it's 12 digits and starts with 91, replace 91 with +91
    if (cleaned.length === 12 && cleaned.startsWith("91")) {
        return `+91${cleaned.slice(2)}`;
    }
    
    // If it's already structured but may have been cleaned (e.g., 9191...)
    // we take the last 10 digits and add +91 to be safe for Indian numbers
    if (cleaned.length > 10) {
        return `+91${cleaned.slice(-10)}`;
    }
    
    return cleaned; // Fallback for invalid or short numbers
};

/**
 * Extracts the last 10 digits of a phone number.
 * Useful for legacy database searches where +91 might be missing.
 * 
 * @param {string|number} phone 
 * @returns {string} 10-digit phone number.
 */
const get10DigitPhone = (phone) => {
    if (!phone) return "";
    let cleaned = phone.toString().replace(/\D/g, "");
    return cleaned.slice(-10);
};

module.exports = {
    normalizePhoneNumber,
    get10DigitPhone
};
