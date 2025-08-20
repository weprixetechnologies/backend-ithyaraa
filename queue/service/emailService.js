

const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Load and cache templates
const templates = {};
const templateDir = path.join(__dirname, "..", "..", "templates");

fs.readdirSync(templateDir).forEach(file => {
	const templateName = path.basename(file, ".html");
	templates[templateName] = fs.readFileSync(path.join(templateDir, file), "utf8");
});

// Utility to replace {{placeholders}}
function renderTemplate(template, variables) {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || "");
}

// Nodemailer setup
const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: process.env.GMAIL_USER,
		pass: process.env.GMAIL_APP_PASSWORD
	}
});

async function sendEmail({ to, templateName, variables, subject }) {
	if (!templates[templateName]) {
		throw new Error(`Template \"${templateName}\" not found`);
	}

	const html = renderTemplate(templates[templateName], variables);

	await transporter.sendMail({
		from: `"Ithyaraa" <${process.env.MAIL_USER}>`,
		to,
		subject,
		html
	});

    console.log( process.env.GMAIL_USER,
	 process.env.GMAIL_APP_PASSWORD);
    
}

module.exports = { sendEmail };
