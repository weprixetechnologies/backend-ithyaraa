const db = require('./utils/dbconnect');

async function getSections() {
    try {
        const [rows] = await db.execute("SELECT DISTINCT sectionid FROM products WHERE sectionid IS NOT NULL AND sectionid != '';");
        console.log(JSON.stringify(rows));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

getSections();
