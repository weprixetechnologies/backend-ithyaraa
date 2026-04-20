const formatPhoneNumber = (phone) => {
    if (phone === null || phone === undefined || phone === '') return phone;
    let cleaned = phone.toString().replace(/\D/g, '').slice(-10);
    if (cleaned.length === 10) {
        return `+91${cleaned}`;
    }
    return phone;
};

const recursivelyFormatPhones = (obj) => {
    if (Array.isArray(obj)) {
        obj.forEach((item) => recursivelyFormatPhones(item));
    } else if (obj !== null && typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string' || typeof value === 'number') {
                if (key.match(/verifiedPhone/i) || key.match(/phoneVerified/i) || key.match(/phonePe/i)) {
                    continue;
                }
                if (key.match(/phone/i)) {
                    obj[key] = formatPhoneNumber(value);
                }
            } else if (typeof value === 'object') {
                recursivelyFormatPhones(value);
            }
        }
    }
};

const phoneFormatterMiddleware = (req, res, next) => {
    if (req.body) {
        recursivelyFormatPhones(req.body);
    }
    if (req.query) {
        recursivelyFormatPhones(req.query);
    }
    next();
};

module.exports = phoneFormatterMiddleware;
