const db = require('./utils/dbconnect');
async function run() {
    try {
        console.log('Modifying support_tickets.raised_by_id...');
        await db.execute('ALTER TABLE support_tickets MODIFY raised_by_id VARCHAR(50) NOT NULL');
        console.log('Modifying support_ticket_replies.sender_id...');
        await db.execute('ALTER TABLE support_ticket_replies MODIFY sender_id VARCHAR(50) NOT NULL');
        console.log('Success!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
