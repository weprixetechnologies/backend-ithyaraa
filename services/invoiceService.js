const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class InvoiceService {
    constructor() {
        this.companyInfo = {
            name: 'ITHYAARA FASHIONS PVT LTD',
            address: {
                line1: '203, 2nd Floor, SBR, C.V.TOWERS',
                line2: 'HUDA Techno Enclave, Madhapur',
                line3: 'Hyderabad, Telangana-500081'
            },
            gstin: 'GSTIN: 36AAHCI0804Q1ZB'
        };
    }

    // Generate PDF invoice buffer using Puppeteer (HTML to PDF) and optionally compress
    async generateInvoicePDF(orderData) {
        try {
            // Build HTML
            const htmlContent = this.generateInvoiceHTML(orderData);
            console.log('Generated HTML content for invoice, length:', htmlContent.length);

            // Launch Puppeteer (allow overriding executable path in prod)
            const launchOptions = {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--disable-default-apps',
                    '--disable-extensions',
                    '--disable-software-rasterizer'
                ]
            };

            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
                console.log('Using custom Puppeteer executable path');
            }

            console.log('Launching Puppeteer browser...');
            const browser = await puppeteer.launch(launchOptions);
            console.log('Browser launched successfully');

            const page = await browser.newPage();
            console.log('Setting HTML content...');
            await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
            console.log('Generating PDF...');

            const pdfBuffer = await page.pdf({
                format: 'A4',
                margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
                printBackground: true,
                preferCSSPageSize: true,
                displayHeaderFooter: false
            });

            console.log('PDF generated, size:', pdfBuffer.length, 'bytes');
            await browser.close();

            let pdfBufferResult = Buffer.from(pdfBuffer);

            // Try to compress using Ghostscript if available (non-blocking, fails gracefully)
            try {
                const compressed = await this.compressPdfIfPossible(pdfBufferResult);
                if (compressed && compressed.length > 0) {
                    console.log(`PDF compressed: ${pdfBufferResult.length} -> ${compressed.length} bytes`);
                    return compressed;
                }
            } catch (compressError) {
                console.log('PDF compression skipped:', compressError.message);
                // Continue with uncompressed PDF
            }

            return pdfBufferResult;
        } catch (error) {
            console.error('PDF generation error:', error);
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }

    async compressPdfIfPossible(inputBuffer) {
        return new Promise((resolve, reject) => {
            // Try to run Ghostscript compression
            const args = [
                '-sDEVICE=pdfwrite',
                '-dCompatibilityLevel=1.4',
                '-dPDFSETTINGS=/ebook',
                '-dNOPAUSE',
                '-dQUIET',
                '-dBATCH',
                '-sOutputFile=-',
                '-' // read from stdin
            ];

            const proc = spawn('gs', args);
            const chunks = [];
            const timeout = setTimeout(() => {
                proc.kill();
                reject(new Error('Compression timeout'));
            }, 10000); // 10 second timeout

            proc.stdout.on('data', (d) => chunks.push(d));
            proc.stderr.on('data', () => { }); // Ignore stderr
            proc.on('error', (err) => {
                clearTimeout(timeout);
                reject(new Error(`Ghostscript not available: ${err.message}`));
            });
            proc.on('close', (code) => {
                clearTimeout(timeout);
                if (code === 0 && chunks.length > 0) {
                    resolve(Buffer.concat(chunks));
                } else {
                    reject(new Error(`Compression failed with code ${code}`));
                }
            });

            proc.stdin.write(inputBuffer);
            proc.stdin.end();
        });
    }

    // Generate HTML template for invoice
    generateInvoiceHTML(orderData) {
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(orderData.orderID).padStart(3, '0')}`;

        // Load logo as base64
        const fs = require('fs');
        const path = require('path');
        const logoPath = path.join(__dirname, '..', 'asset', 'ithyaraa-logo.png');
        let logoDataUrl = '';

        try {
            if (fs.existsSync(logoPath)) {
                const logoBuffer = fs.readFileSync(logoPath);
                const logoBase64 = logoBuffer.toString('base64');
                logoDataUrl = 'data:image/png;base64,' + logoBase64;
            }
        } catch (error) {
            console.log('Logo not found, using fallback');
        }

        // Calculate totals
        const itemTotal = orderData.items.reduce((sum, item) => sum + item.lineTotalAfter, 0);
        const shipping = orderData.shipping || 0;
        const balanceDue = itemTotal + shipping;

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoiceNumber}</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;line-height:1.4;color:#333;background:white}
        .invoice-container{max-width:800px;margin:0 auto;padding:15px}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
        .logo{width:150px;height:150px;display:flex;align-items:center;justify-content:center}
        .logo img{max-width:100%;max-height:100%;object-fit:contain}
        .company-info{text-align:right}
        .company-info h1{font-size:16px;margin-bottom:8px}
        .company-info p{font-size:11px;margin:1px 0}
        .invoice-title{font-size:28px;font-weight:bold;margin:20px 0 15px 0}
        .divider{height:2px;background:#000;margin:15px 0}
        .details-section{display:flex;gap:20px;margin:20px 0}
        .invoice-details,.customer-details{width:50%;border:1px solid #ddd;padding:15px;border-radius:4px}
        .invoice-details h3,.customer-details h3{font-size:14px;margin-bottom:12px;color:#333;border-bottom:1px solid #eee;padding-bottom:5px}
        .detail-row{display:flex;margin:8px 0;align-items:center}
        .detail-label{font-weight:bold;width:120px;color:#555;font-size:12px}
        .detail-value{flex:1;font-size:12px;color:#333}
        .customer-details{text-align:left}
        .customer-details .detail-row{justify-content:flex-start}
        
        .items-table{width:100%;border-collapse:collapse;margin:20px 0;font-size:11px}
        .items-table th{background:#f8f9fa;padding:8px 4px;text-align:left;font-weight:bold;border:1px solid #000;font-size:10px}
        .items-table td{padding:8px 4px;border:1px solid #000;font-size:10px}
        .items-table .number{text-align:right}
        .items-table th.number{text-align:right}
        .summary-signature-section{display:flex;justify-content:space-between;margin-top:20px}
        .summary-section{flex:1}
        .summary-table{width:280px;margin-left:auto}
        .summary-table .summary-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ddd}
        .summary-table .balance-due{font-weight:bold;border-top:2px solid #000;border-bottom:2px solid #000}
        .signature-section{flex:1;display:flex;justify-content:flex-start;align-items:flex-end}
        .signature-content{text-align:right}
        .signature-content p{margin:3px 0;font-size:11px}
        .footer{text-align:center;margin-top:30px;font-size:11px;color:#666}
        
        @media print {
            body { -webkit-print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div class="logo">
                ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Ithyaraa Logo" />` : `
                <div style="width:150px;height:150px;background:#1e40af;display:flex;flex-direction:column;justify-content:center;align-items:center;color:white;font-weight:bold;border-radius:4px;">
                    <div style="font-size:20px;line-height:1.1;">ITHYAARA</div>
                    <div style="font-size:10px;margin-top:2px;">FASHIONS</div>
                </div>
                `}
            </div>
            <div class="company-info">
                <h1>${this.companyInfo.name}</h1>
                <p>${this.companyInfo.address.line1}</p>
                <p>${this.companyInfo.address.line2}</p>
                <p>${this.companyInfo.address.line3}</p>
                <p>${this.companyInfo.gstin}</p>
            </div>
        </div>
        
        <div class="invoice-title">Invoice</div>
        <div class="divider"></div>
        
        <div class="details-section">
            <div class="invoice-details">
                <h3>Invoice Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Invoice Number:</span>
                    <span class="detail-value">${invoiceNumber}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Invoice Date:</span>
                    <span class="detail-value">${new Date(orderData.createdAt).toLocaleDateString('en-IN')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Order ID:</span>
                    <span class="detail-value">#${orderData.orderID}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Payment Mode:</span>
                    <span class="detail-value">${orderData.paymentMode}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Amount:</span>
                    <span class="detail-value">₹${orderData.total.toFixed(2)}</span>
                </div>
            </div>
            <div class="customer-details">
                <h3>Bill To / Ship To</h3>
                ${orderData.deliveryAddress ? `
                <div class="detail-row">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value">${orderData.deliveryAddress.emailID}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value">${orderData.deliveryAddress.phoneNumber}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Address:</span>
                    <span class="detail-value">${orderData.deliveryAddress.line1}</span>
                </div>
                ${orderData.deliveryAddress.line2 ? `
                <div class="detail-row">
                    <span class="detail-label"></span>
                    <span class="detail-value">${orderData.deliveryAddress.line2}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                    <span class="detail-label">City:</span>
                    <span class="detail-value">${orderData.deliveryAddress.city}, ${orderData.deliveryAddress.state} - ${orderData.deliveryAddress.pincode}</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th>SR No</th>
                    <th>Item & Description</th>
                    <th class="number">Qty</th>
                    <th class="number">Product Rate</th>
                    <th class="number">Disc.</th>
                    <th class="number">Taxable Amt.</th>
                    <th class="number">CGST</th>
                    <th class="number">SGST</th>
                    <th class="number">CGST Amt.</th>
                    <th class="number">SGST Amt.</th>
                    <th class="number">Total Amt.</th>
                </tr>
            </thead>
            <tbody>
                ${orderData.items.map((item, index) => {
            const totalAmount = item.lineTotalAfter;
            const taxRate = 5; // 5% total GST
            const taxableAmount = totalAmount / (1 + taxRate / 100);
            const unitPrice = taxableAmount / item.quantity;
            const cgstRate = 2.5;
            const sgstRate = 2.5;
            const cgstAmount = (taxableAmount * cgstRate) / 100;
            const sgstAmount = (taxableAmount * sgstRate) / 100;

            return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.name}</td>
                        <td class="number">${item.quantity}</td>
                        <td class="number">₹${unitPrice.toFixed(2)}</td>
                        <td class="number">0</td>
                        <td class="number">₹${taxableAmount.toFixed(2)}</td>
                        <td class="number">${cgstRate}%</td>
                        <td class="number">${sgstRate}%</td>
                        <td class="number">₹${cgstAmount.toFixed(2)}</td>
                        <td class="number">₹${sgstAmount.toFixed(2)}</td>
                        <td class="number">₹${totalAmount.toFixed(2)}</td>
                    </tr>
                    `;
        }).join('')}
            </tbody>
        </table>
        
        <!-- Summary and Signature Section -->
        <div class="summary-signature-section">
            <div class="signature-section">
                <div class="signature-content">
                    <p><strong>Digitally Signed by:</strong></p>
                    <p><strong>Ithyaraa Fashions Pvt Ltd</strong></p>
                    <p><strong>Location: Telangana</strong></p>
                </div>
            </div>
            <div class="summary-section">
                <div class="summary-table">
                    <div class="summary-row">
                        <span>Item Total</span>
                        <span>₹${itemTotal.toFixed(2)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Shipping Charge (Inclusive of Taxes)</span>
                        <span>₹${shipping.toFixed(2)}</span>
                    </div>
                    <div class="summary-row balance-due">
                        <span>Invoice Value</span>
                        <span>₹${balanceDue.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <p>Payment is due within 15 days. Thank you for your business.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    // Generate invoice data for frontend
    generateInvoiceData(orderData) {
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(orderData.orderID).padStart(3, '0')}`;

        return {
            invoiceNumber,
            orderID: orderData.orderID,
            createdAt: orderData.createdAt,
            items: orderData.items || [],
            subtotal: orderData.subtotal || 0,
            discount: orderData.discount || 0,
            shipping: orderData.shipping || 0,
            total: orderData.total || 0,
            deliveryAddress: orderData.deliveryAddress || {},
            paymentMode: orderData.paymentMode || 'COD',
            status: orderData.status || 'confirmed'
        };
    }
}

module.exports = new InvoiceService();