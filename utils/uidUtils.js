const generateUID = () => {
    const numbers = String(Math.floor(Math.random() * 90) + 10); // ensures 10–99
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let alphaNum = '';
    for (let i = 0; i < 6; i++) {
        alphaNum += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return numbers + alphaNum;
};

module.exports = { generateUID }