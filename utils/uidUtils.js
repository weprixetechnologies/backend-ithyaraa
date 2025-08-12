const generateUID = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = Math.random().toString(16).slice(2, 8);
    return `USR-${date}-${randomHex}`;
};

module.exports = { generateUID }