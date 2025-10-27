const generateUID = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let alphaNum = '';
    for (let i = 0; i < 7; i++) {
        alphaNum += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'IBR' + alphaNum; // Format: IBR + 7 alphanumeric characters
};

module.exports = { generateUID }