const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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

    // Generate PDF invoice buffer using PDFKit with careful layout and page-break handling
    async generateInvoicePDF(orderData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));
                doc.on('error', reject);

                const pageWidth = doc.page.width;
                const pageHeight = doc.page.height;
                const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;
                const startX = doc.page.margins.left;
                let cursorY = doc.page.margins.top;

                const ensureSpace = (needed) => {
                    if (cursorY + needed > pageHeight - doc.page.margins.bottom) {
                        doc.addPage();
                        cursorY = doc.page.margins.top;
                    }
                };
                const advance = (dy) => { cursorY += dy; };

                // Header
                const logoPath = path.join(__dirname, '..', 'asset', 'ithyaraa-logo.png');
                const hasLogo = fs.existsSync(logoPath);
                ensureSpace(90);
                if (hasLogo) {
                    try { doc.image(logoPath, startX, cursorY, { width: 120, height: 80, fit: [120, 80] }); } catch (_) { }
                } else {
                    doc.rect(startX, cursorY, 120, 80).fill('#1e40af');
                    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(16).text('ITHYAARA', startX + 10, cursorY + 25);
                    doc.font('Helvetica').fontSize(10).text('FASHIONS', startX + 10, cursorY + 45);
                    doc.fillColor('#000');
                }
                const infoX = startX + contentWidth - 280;
                doc.fontSize(14).font('Helvetica-Bold').text(this.companyInfo.name, infoX, cursorY, { width: 280, align: 'right' });
                doc.fontSize(10).font('Helvetica').text(this.companyInfo.address.line1, infoX, cursorY + 20, { width: 280, align: 'right' });
                doc.text(this.companyInfo.address.line2, infoX, cursorY + 35, { width: 280, align: 'right' });
                doc.text(this.companyInfo.address.line3, infoX, cursorY + 50, { width: 280, align: 'right' });
                doc.text(this.companyInfo.gstin, infoX, cursorY + 65, { width: 280, align: 'right' });
                advance(100);

                // Title
                ensureSpace(30);
                doc.fontSize(22).font('Helvetica-Bold').text('Invoice', startX, cursorY);
                advance(10);
                doc.moveTo(startX, cursorY + 10).lineTo(startX + contentWidth, cursorY + 10).stroke();
                advance(20);

                // Details boxes
                const gap = 16; const half = (contentWidth - gap) / 2;
                const left = { x: startX, y: cursorY, w: half, h: 120 };
                const right = { x: startX + half + gap, y: cursorY, w: half, h: 120 };
                ensureSpace(140);
                doc.roundedRect(left.x, left.y, left.w, left.h, 6).stroke();
                doc.roundedRect(right.x, right.y, right.w, right.h, 6).stroke();

                const label = (x, y, t) => doc.font('Helvetica-Bold').text(t, x, y);
                const val = (x, y, t) => doc.font('Helvetica').text(t, x, y);

                let ly = left.y + 12;
                doc.fontSize(12).font('Helvetica-Bold').text('Invoice Details', left.x + 10, ly);
                ly += 16; doc.fontSize(10);
                label(left.x + 10, ly, 'Invoice Number:'); val(left.x + 120, ly, this._formatInvoiceNumber(orderData)); ly += 14;
                label(left.x + 10, ly, 'Invoice Date:'); val(left.x + 120, ly, new Date(orderData.createdAt).toLocaleDateString('en-IN')); ly += 14;
                label(left.x + 10, ly, 'Order ID:'); val(left.x + 120, ly, `#${orderData.orderID}`); ly += 14;
                label(left.x + 10, ly, 'Payment Mode:'); val(left.x + 120, ly, String(orderData.paymentMode || '')); ly += 14;
                label(left.x + 10, ly, 'Total Amount:'); val(left.x + 120, ly, `₹${Number(orderData.total || 0).toFixed(2)}`);

                let ry = right.y + 12;
                doc.fontSize(12).font('Helvetica-Bold').text('Bill To / Ship To', right.x + 10, ry);
                ry += 16; doc.fontSize(10).font('Helvetica');
                const addr = orderData.deliveryAddress || {};
                if (addr.emailID) { doc.text(`Email: ${addr.emailID}`, right.x + 10, ry, { width: right.w - 20 }); ry += 14; }
                if (addr.phoneNumber) { doc.text(`Phone: ${addr.phoneNumber}`, right.x + 10, ry, { width: right.w - 20 }); ry += 14; }
                if (addr.line1) { doc.text(`Address: ${addr.line1}`, right.x + 10, ry, { width: right.w - 20 }); ry += 14; }
                if (addr.line2) { doc.text(addr.line2, right.x + 10, ry, { width: right.w - 20 }); ry += 14; }
                if (addr.city || addr.state || addr.pincode) {
                    doc.text(`${addr.city || ''}, ${addr.state || ''} ${addr.pincode ? '- ' + addr.pincode : ''}`, right.x + 10, ry, { width: right.w - 20 }); ry += 14;
                }

                advance(Math.max(left.h, right.h) + 20);

                // Items table
                ensureSpace(60);
                const cols = [
                    { label: 'SR', w: 30, align: 'left' },
                    { label: 'Item & Description', w: 200, align: 'left' },
                    { label: 'Qty', w: 40, align: 'right' },
                    { label: 'Rate', w: 60, align: 'right' },
                    { label: 'Taxable', w: 70, align: 'right' },
                    { label: 'CGST', w: 50, align: 'right' },
                    { label: 'SGST', w: 50, align: 'right' },
                    { label: 'Total', w: 60, align: 'right' }
                ];
                const draw = (y, cells, header = false) => {
                    let x = startX; cells.forEach((c, i) => { const col = cols[i]; doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).text(c, x, y, { width: col.w, align: col.align }); x += col.w + 6; });
                };
                draw(cursorY, cols.map(c => c.label), true); advance(14); doc.moveTo(startX, cursorY).lineTo(startX + contentWidth, cursorY).stroke();

                const items = Array.isArray(orderData.items) ? orderData.items : [];
                let itemTotal = 0;
                items.forEach((it, idx) => {
                    ensureSpace(18);
                    const totalAmount = Number(it.lineTotalAfter || 0); itemTotal += totalAmount;
                    const taxRate = 5; const taxableAmount = totalAmount / (1 + taxRate / 100);
                    const unitPrice = taxableAmount / Number(it.quantity || 1);
                    draw(cursorY, [
                        String(idx + 1),
                        String(it.name || ''),
                        String(it.quantity || 0),
                        `₹${unitPrice.toFixed(2)}`,
                        `₹${taxableAmount.toFixed(2)}`,
                        '2.5%', '2.5%', `₹${totalAmount.toFixed(2)}`
                    ]);
                    advance(16);
                });

                advance(10);
                // Summary
                ensureSpace(80);
                const shipping = Number(orderData.shipping || 0);
                const balanceDue = itemTotal + shipping;
                const sx = startX + contentWidth - 260;
                const row = (lbl, val, bold) => { doc.fontSize(10).font(bold ? 'Helvetica-Bold' : 'Helvetica').text(lbl, sx, cursorY, { width: 160 }); doc.text(val, sx + 170, cursorY, { width: 90, align: 'right' }); advance(16); };
                row('Item Total', `₹${itemTotal.toFixed(2)}`);
                row('Shipping Charge (Inclusive of Taxes)', `₹${shipping.toFixed(2)}`);
                doc.moveTo(sx, cursorY).lineTo(sx + 260, cursorY).stroke(); advance(6);
                row('Invoice Value', `₹${balanceDue.toFixed(2)}`, true);
                doc.moveTo(sx, cursorY).lineTo(sx + 260, cursorY).stroke();

                // Signature
                ensureSpace(50);
                doc.fontSize(10).font('Helvetica-Bold').text('Digitally Signed by:', startX, cursorY); advance(14);
                doc.font('Helvetica').text('Ithyaraa Fashions Pvt Ltd', startX, cursorY); advance(14);
                doc.text('Location: Telangana', startX, cursorY);

                // Footer
                doc.fontSize(9).font('Helvetica').text('Payment is due within 15 days. Thank you for your business.', startX, pageHeight - doc.page.margins.bottom - 10, { width: contentWidth, align: 'center' });

                doc.end();
            } catch (err) {
                reject(new Error(`PDF generation failed: ${err.message}`));
            }
        });
    }

    _formatInvoiceNumber(orderData) {
        return `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(orderData.orderID).padStart(3, '0')}`;
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