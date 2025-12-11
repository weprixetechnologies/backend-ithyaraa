const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class BrandInvoiceService {
    constructor() {
        this.ithyaraaInfo = {
            name: 'ITHYAARA FASHIONS PVT LTD',
            address: {
                line1: '203, 2nd Floor, SBR, C.V.TOWERS',
                line2: 'HUDA Techno Enclave, Madhapur',
                line3: 'Hyderabad, Telangana-500081'
            },
            gstin: 'GSTIN: 36AAHCI0804Q1ZB'
        };
    }

    // Generate PDF invoice buffer for brand (biller: brand, to: Ithyaraa)
    async generateBrandInvoicePDF(brandInfo, orderItems, dateRange) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margins: { top: 50, bottom: 50, left: 50, right: 50 }
                });

                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));
                doc.on('error', reject);

                const pageWidth = doc.page.width;
                const pageHeight = doc.page.height;
                const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;
                const startX = doc.page.margins.left;
                let cursorY = doc.page.margins.top;

                // Helpers
                const ensureSpace = (needed = 50) => {
                    if (cursorY + needed > pageHeight - doc.page.margins.bottom) {
                        doc.addPage();
                        cursorY = doc.page.margins.top;
                    }
                };
                const advance = (dy = 10) => (cursorY += dy);

                // Brand Logo/Info (Left side - Biller)
                ensureSpace(100);
                const logoPath = path.join(__dirname, '..', 'asset', 'ithyaraa-logo.png');
                const hasLogo = fs.existsSync(logoPath);

                if (hasLogo) {
                    doc.image(logoPath, startX, cursorY, { width: 100 });
                } else {
                    doc.rect(startX, cursorY, 100, 60).fill('#1e40af');
                    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(14).text('BRAND', startX + 10, cursorY + 20);
                    doc.fillColor('#000');
                }

                // Brand Info (Biller)
                const brandInfoX = startX;
                const brandInfoY = cursorY + 70;
                doc.fontSize(13).font('Helvetica-Bold').text(brandInfo.name || 'BRAND NAME', brandInfoX, brandInfoY, { width: 260 });
                doc.fontSize(10).font('Helvetica');
                if (brandInfo.address) {
                    if (brandInfo.address.line1) doc.text(brandInfo.address.line1, brandInfoX, brandInfoY + 18, { width: 260 });
                    if (brandInfo.address.line2) doc.text(brandInfo.address.line2, brandInfoX, brandInfoY + 32, { width: 260 });
                    if (brandInfo.address.line3) doc.text(brandInfo.address.line3, brandInfoX, brandInfoY + 46, { width: 260 });
                }
                if (brandInfo.gstin) doc.text(brandInfo.gstin, brandInfoX, brandInfoY + 60, { width: 260 });

                // Ithyaraa Info (Right side - Bill To)
                const infoX = startX + contentWidth - 260;
                doc.fontSize(13).font('Helvetica-Bold').text(this.ithyaraaInfo.name, infoX, cursorY, { width: 260, align: 'right' });
                doc.fontSize(10).font('Helvetica')
                    .text(this.ithyaraaInfo.address.line1, infoX, cursorY + 18, { width: 260, align: 'right' })
                    .text(this.ithyaraaInfo.address.line2, infoX, cursorY + 32, { width: 260, align: 'right' })
                    .text(this.ithyaraaInfo.address.line3, infoX, cursorY + 46, { width: 260, align: 'right' })
                    .text(this.ithyaraaInfo.gstin, infoX, cursorY + 60, { width: 260, align: 'right' });
                advance(100);

                // --- TITLE ---
                ensureSpace(40);
                doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', startX, cursorY);
                advance(20);
                doc.moveTo(startX, cursorY).lineTo(startX + contentWidth, cursorY).stroke();
                advance(20);

                // --- BOXES ---
                const gap = 20;
                const boxHeight = 120;
                const halfWidth = (contentWidth - gap) / 2;
                const left = { x: startX, y: cursorY, w: halfWidth, h: boxHeight };
                const right = { x: startX + halfWidth + gap, y: cursorY, w: halfWidth, h: boxHeight };
                ensureSpace(boxHeight + 20);

                doc.roundedRect(left.x, left.y, left.w, left.h, 8).stroke();
                doc.roundedRect(right.x, right.y, right.w, right.h, 8).stroke();

                const label = (x, y, t) => doc.font('Helvetica-Bold').text(t, x, y);
                const val = (x, y, t) => doc.font('Helvetica').text(t, x, y);

                let ly = left.y + 15;
                doc.fontSize(11).font('Helvetica-Bold').text('Invoice Details', left.x + 10, ly);
                ly += 18; doc.fontSize(10);
                const safeVal = (v) => v || '-';
                const invoiceNumber = `INV-${dateRange.startDate || new Date().toISOString().split('T')[0]}-${dateRange.endDate || new Date().toISOString().split('T')[0]}`;
                label(left.x + 10, ly, 'Invoice No:'); val(left.x + 110, ly, invoiceNumber); ly += 14;
                label(left.x + 10, ly, 'Invoice Date:'); val(left.x + 110, ly, new Date().toLocaleDateString('en-IN')); ly += 14;
                label(left.x + 10, ly, 'Period:'); val(left.x + 110, ly, `${dateRange.startDate || '-'} to ${dateRange.endDate || '-'}`); ly += 14;
                label(left.x + 10, ly, 'Total Items:'); val(left.x + 110, ly, `${orderItems.length}`); ly += 14;
                const totalAmount = orderItems.reduce((sum, item) => sum + (Number(item.lineTotalAfter) || 0), 0);
                label(left.x + 10, ly, 'Total Amount:'); val(left.x + 110, ly, `Rs. ${totalAmount.toFixed(2)}`);

                let ry = right.y + 15;
                doc.fontSize(11).font('Helvetica-Bold').text('Bill To', right.x + 10, ry);
                ry += 18; doc.fontSize(10);
                doc.text(this.ithyaraaInfo.name, right.x + 10, ry, { width: right.w - 20 }); ry += 14;
                doc.text(this.ithyaraaInfo.address.line1, right.x + 10, ry, { width: right.w - 20 }); ry += 14;
                doc.text(this.ithyaraaInfo.address.line2, right.x + 10, ry, { width: right.w - 20 }); ry += 14;
                doc.text(this.ithyaraaInfo.address.line3, right.x + 10, ry, { width: right.w - 20 }); ry += 14;
                doc.text(this.ithyaraaInfo.gstin, right.x + 10, ry, { width: right.w - 20 });
                advance(boxHeight + 30);

                // --- ITEMS TABLE ---
                ensureSpace(40);

                const cols = [
                    { label: 'SR', w: 25, align: 'left' },
                    { label: 'Order ID', w: 80, align: 'left' },
                    { label: 'Item & Description', w: 150, align: 'left' },
                    { label: 'Qty', w: 35, align: 'right' },
                    { label: 'Rate', w: 60, align: 'right' },
                    { label: 'Taxable', w: 70, align: 'right' },
                    { label: 'CGST', w: 45, align: 'right' },
                    { label: 'SGST', w: 45, align: 'right' },
                    { label: 'Total', w: 65, align: 'right' }
                ];

                const totalColsWidth = cols.reduce((a, c) => a + c.w, 0);
                const colSpacing = (contentWidth - totalColsWidth) / (cols.length - 1);

                const drawRow = (y, cells, bold = false) => {
                    let x = startX;
                    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
                    cells.forEach((c, i) => {
                        doc.text(String(c), x, y, { width: cols[i].w, align: cols[i].align });
                        x += cols[i].w + colSpacing;
                    });
                };

                drawRow(cursorY, cols.map(c => c.label), true);
                advance(14);
                doc.moveTo(startX, cursorY).lineTo(startX + contentWidth, cursorY).stroke();
                advance(6);

                let itemTotal = 0;
                let srNo = 1;

                for (const it of orderItems) {
                    ensureSpace(30);
                    const total = Number(it.lineTotalAfter || 0);
                    itemTotal += total;
                    const taxRate = 5;
                    const taxable = total / (1 + taxRate / 100);
                    const unitPrice = taxable / (Number(it.quantity) || 1);

                    const descWidth = cols[2].w;
                    const descText = `${it.name || '-'}${it.variationName ? ` (${it.variationName})` : ''}`;
                    const descHeight = doc.heightOfString(descText, { width: descWidth });
                    const rowHeight = Math.max(18, descHeight + 4);

                    let x = startX;
                    doc.fontSize(9).font('Helvetica');

                    doc.text(srNo.toString(), x, cursorY, { width: cols[0].w, align: cols[0].align });
                    x += cols[0].w + colSpacing;

                    doc.text(`#${it.orderID || '-'}`, x, cursorY, { width: cols[1].w, align: cols[1].align });
                    x += cols[1].w + colSpacing;

                    doc.text(descText, x, cursorY, { width: descWidth, align: 'left' });
                    x += descWidth + colSpacing;

                    doc.text(it.quantity || 0, x, cursorY, { width: cols[3].w, align: 'right' });
                    x += cols[3].w + colSpacing;

                    doc.text(`Rs. ${unitPrice.toFixed(2)}`, x, cursorY, { width: cols[4].w, align: 'right' });
                    x += cols[4].w + colSpacing;

                    doc.text(`Rs. ${taxable.toFixed(2)}`, x, cursorY, { width: cols[5].w, align: 'right' });
                    x += cols[5].w + colSpacing;

                    doc.text('2.5%', x, cursorY, { width: cols[6].w, align: 'right' });
                    x += cols[6].w + colSpacing;

                    doc.text('2.5%', x, cursorY, { width: cols[7].w, align: 'right' });
                    x += cols[7].w + colSpacing;

                    doc.text(`Rs. ${total.toFixed(2)}`, x, cursorY, { width: cols[8].w, align: 'right' });

                    advance(rowHeight);
                    srNo++;
                }

                // --- SUMMARY ---
                ensureSpace(100);
                const sx = startX + contentWidth - 260;
                const row = (lbl, val, bold = false) => {
                    doc.fontSize(10).font(bold ? 'Helvetica-Bold' : 'Helvetica');
                    doc.text(lbl, sx, cursorY, { width: 150 });
                    doc.text(val, sx + 160, cursorY, { width: 100, align: 'right' });
                    advance(16);
                };

                advance(10);
                row('Item Total', `Rs. ${itemTotal.toFixed(2)}`);
                doc.moveTo(sx, cursorY).lineTo(sx + 260, cursorY).stroke(); advance(6);
                row('Invoice Total', `Rs. ${itemTotal.toFixed(2)}`, true);
                doc.moveTo(sx, cursorY).lineTo(sx + 260, cursorY).stroke();

                // --- SIGNATURE ---
                ensureSpace(60);
                advance(10);
                doc.fontSize(10).font('Helvetica-Bold').text('Digitally Signed by:', startX, cursorY);
                advance(14);
                doc.font('Helvetica').text(brandInfo.name || 'Brand', startX, cursorY);
                advance(14);
                if (brandInfo.address && brandInfo.address.line3) {
                    doc.text(`Location: ${brandInfo.address.line3}`, startX, cursorY);
                }

                // --- FOOTER ---
                doc.fontSize(9).font('Helvetica')
                    .text('Payment is due within 15 days. Thank you for your business.',
                        startX,
                        pageHeight - doc.page.margins.bottom - 20,
                        { width: contentWidth, align: 'center' });

                doc.end();
            } catch (err) {
                reject(new Error(`PDF generation failed: ${err.message}`));
            }
        });
    }
}

module.exports = new BrandInvoiceService();

