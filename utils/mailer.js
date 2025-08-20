// mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

// Optional: verify transporter on startup (useful in dev)
transporter.verify((err, success) => {
    if (err) {
        console.error("Mail transporter verification failed:", err);
    } else {
        console.log("Mail transporter is ready");
    }
});

module.exports = transporter;
