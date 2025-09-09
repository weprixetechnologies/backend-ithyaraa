
function deepParse(obj) {
    if (Array.isArray(obj)) {
        return obj.map(deepParse);
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            acc[key] = deepParse(obj[key]);
            return acc;
        }, {});
    } else if (typeof obj === 'string') {
        try {
            // Attempt to parse JSON strings
            const parsed = JSON.parse(obj);
            // If parsing is successful, recursively parse the result
            return deepParse(parsed);
        } catch (e) {
            // If parsing fails, return the original string
            return obj;
        }
    }
    return obj;
}

module.exports = {
    deepParse
};
