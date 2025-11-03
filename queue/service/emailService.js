

const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Load and cache templates
const templates = {};
const templateDir = path.join(__dirname, "..", "..", "templates");

fs.readdirSync(templateDir).forEach(file => {
	if (file.endsWith('.html')) {
		const templateName = path.basename(file, ".html");
		templates[templateName] = fs.readFileSync(path.join(templateDir, file), "utf8");
	}
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

async function sendEmail({ to, templateName, variables, subject, attachments = [] }) {
	if (!templates[templateName]) {
		throw new Error(`Template \"${templateName}\" not found`);
	}

	const html = renderTemplate(templates[templateName], variables);

	const mailOptions = {
		from: `"Ithyaraa" <${process.env.GMAIL_USER}>`,
		to,
		subject,
		html
	};

	// Add attachments if provided
	if (attachments && attachments.length > 0) {
		console.log(`Processing ${attachments.length} attachments...`);

		// Process attachments to ensure proper format
		mailOptions.attachments = attachments.map((attachment, index) => {
			console.log(`Processing attachment ${index + 1}:`);
			console.log(`  Filename: ${attachment.filename}`);
			console.log(`  Content type: ${attachment.contentType}`);
			console.log(`  Encoding: ${attachment.encoding || 'none'}`);
			console.log(`  Content length: ${attachment.content ? (typeof attachment.content === 'string' ? attachment.content.length : attachment.content.length) : 'undefined'}`);
			console.log(`  Content is Buffer: ${Buffer.isBuffer(attachment.content)}`);
			console.log(`  Content type: ${typeof attachment.content}`);

			// Ensure content is a Buffer
			if (attachment.content) {
				// First priority: Check if it's a base64-encoded string (from queue)
				if (attachment.encoding === 'base64' && typeof attachment.content === 'string') {
					console.log(`  ✅ Decoding base64 string to Buffer...`);
					const buffer = Buffer.from(attachment.content, 'base64');
					console.log(`  Decoded to Buffer: ${buffer.length} bytes`);
					return {
						filename: attachment.filename,
						content: buffer,
						contentType: attachment.contentType
					};
				} else if (Buffer.isBuffer(attachment.content)) {
					console.log(`  ✅ Content is already a Buffer (${attachment.content.length} bytes)`);
					return {
						filename: attachment.filename,
						content: attachment.content,
						contentType: attachment.contentType
					};
				} else if (typeof attachment.content === 'string') {
					// Try to detect if it's base64 (common pattern: base64 strings are longer and contain base64 chars)
					// If it looks like base64 and is for PDF, decode it
					if (attachment.contentType === 'application/pdf' && attachment.content.length > 100 && /^[A-Za-z0-9+/=]+$/.test(attachment.content)) {
						console.log(`  ⚠️  Detected base64 string, decoding to Buffer...`);
						const buffer = Buffer.from(attachment.content, 'base64');
						console.log(`  Decoded to Buffer: ${buffer.length} bytes`);
						return {
							filename: attachment.filename,
							content: buffer,
							contentType: attachment.contentType
						};
					}
					console.log(`  ⚠️  Converting string to Buffer...`);
					const buffer = Buffer.from(attachment.content);
					console.log(`  Converted to Buffer: ${buffer.length} bytes`);
					return {
						filename: attachment.filename,
						content: buffer,
						contentType: attachment.contentType
					};
				} else if (attachment.content instanceof Uint8Array) {
					console.log(`  ⚠️  Converting Uint8Array to Buffer...`);
					const buffer = Buffer.from(attachment.content);
					console.log(`  Converted to Buffer: ${buffer.length} bytes`);
					return {
						filename: attachment.filename,
						content: buffer,
						contentType: attachment.contentType
					};
				} else if (attachment.content && typeof attachment.content === 'object' && attachment.content.data && Array.isArray(attachment.content.data)) {
					// Handle deserialized Buffer from BullMQ (has .data property with array)
					console.log(`  ⚠️  Converting deserialized Buffer to Buffer...`);
					const buffer = Buffer.from(attachment.content.data);
					console.log(`  Converted to Buffer: ${buffer.length} bytes`);
					return {
						filename: attachment.filename,
						content: buffer,
						contentType: attachment.contentType
					};
				} else {
					console.log(`  ⚠️  Converting other type to Buffer...`);
					// For binary content like PDFs, don't convert to string first
					let buffer;
					if (attachment.contentType === 'application/pdf' || attachment.contentType?.includes('pdf')) {
						// For PDFs, try to preserve the original buffer
						if (attachment.content instanceof ArrayBuffer) {
							buffer = Buffer.from(attachment.content);
						} else if (attachment.content && typeof attachment.content === 'object' && attachment.content.length !== undefined) {
							buffer = Buffer.from(attachment.content);
						} else {
							buffer = Buffer.from(attachment.content);
						}
					} else {
						buffer = Buffer.from(String(attachment.content));
					}
					console.log(`  Converted to Buffer: ${buffer.length} bytes`);
					return {
						filename: attachment.filename,
						content: buffer,
						contentType: attachment.contentType
					};
				}
			}

			console.log(`  ❌ No content found for attachment`);
			return attachment;
		});

		console.log(`Final attachments:`, mailOptions.attachments.map(att => ({
			filename: att.filename,
			contentLength: att.content ? att.content.length : 'undefined',
			contentType: att.contentType
		})));
	}

	await transporter.sendMail(mailOptions);

	console.log('Email sent to:', to, 'Subject:', subject);

}

module.exports = { sendEmail };
