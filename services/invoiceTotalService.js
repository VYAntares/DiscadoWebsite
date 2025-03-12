// services/invoiceTotalService.js
const path = require('path');

/**
 * Generates the final page of the invoice with total amount and payment slip
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Object} invoiceData - Data for the invoice total
 * @param {number} invoiceData.totalHT - Total amount excluding VAT
 * @param {number} invoiceData.montantTVA - VAT amount
 * @param {number} invoiceData.totalTTC - Total amount including VAT
 * @param {Date} invoiceData.orderDate - Date of the order
 * @param {String} invoiceData.orderId - Order identifier
 * @param {Object} invoiceData.userProfile - Customer profile information
 * @returns {Promise<void>}
 */
async function generateInvoiceTotalPage(doc, invoiceData) {
  const { totalHT, montantTVA, totalTTC, orderDate, orderId, userProfile } = invoiceData;

  // Toujours ajouter une nouvelle page pour le total de la facture
  doc.addPage();
  
  // Format the order ID
  let formattedOrderId = orderId;
  if (!orderId.match(/\d{4}-\d{4}/)) {
    const orderDateObj = new Date(orderDate);
    const year = orderDateObj.getFullYear().toString().slice(-2);
    const month = (orderDateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = orderDateObj.getDate().toString().padStart(2, '0');
    const hour = orderDateObj.getHours().toString().padStart(2, '0');
    
    formattedOrderId = `${year}${month}-${day}${hour}`;
  } else {
    formattedOrderId = formattedOrderId.replace('order ', '');
  }

  // Add header for the total page
  function addTotalPageHeader() {
    const rootDir = path.resolve(__dirname, '..');
    doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 35, { width: 90 });
    
    doc.font('Helvetica-Bold').fontSize(16);
    doc.text(`Récapitulatif de la Facture ${formattedOrderId}`, 50, 100, { align: 'center' });
    
    doc.font('Helvetica').fontSize(10);
    doc.text(`Date: ${orderDate.toLocaleDateString('Fr')}`, 50, 130, { align: 'center' });
    
    doc.moveDown(2);
  }

  // Add total section
  function addTotalSection() {
    // Summary box
    const boxWidth = 350;
    const boxHeight = 180;
    const boxX = (doc.page.width - boxWidth) / 2;
    const boxY = 180;
    
    // Draw a box for the summary
    doc.rect(boxX, boxY, boxWidth, boxHeight)
      .lineWidth(1)
      .stroke();
    
    // Add box title
    doc.font('Helvetica-Bold').fontSize(14);
    doc.fillColor('#8B0000');
    doc.text('MONTANT TOTAL DE LA FACTURE', boxX + 20, boxY + 20, { 
      width: boxWidth - 40,
      align: 'center'
    });
    
    // Reset color
    doc.fillColor('black');
    
    // Client information
    doc.fontSize(10).font('Helvetica');
    doc.text(`Client: ${userProfile.firstName} ${userProfile.lastName}`, boxX + 20, boxY + 60);
    doc.text(`${userProfile.shopName}`, boxX + 20, boxY + 75);
    
    // Draw separator line
    doc.moveTo(boxX + 20, boxY + 100).lineTo(boxX + boxWidth - 20, boxY + 100).stroke();
    
    // Add totals
    doc.fontSize(10).font('Helvetica');
    doc.text('Sous-total HT:', boxX + 20, boxY + 120);
    doc.text(`${totalHT.toFixed(2)} CHF`, boxX + boxWidth - 100, boxY + 120, { align: 'right' });
    
    doc.text('TVA (8.1%):', boxX + 20, boxY + 140);
    doc.text(`${montantTVA.toFixed(2)} CHF`, boxX + boxWidth - 100, boxY + 140, { align: 'right' });
    
    // Draw separator line for total
    doc.moveTo(boxX + 20, boxY + 160).lineTo(boxX + boxWidth - 20, boxY + 160).stroke();
    
    // Total TTC with emphasis
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('TOTAL TTC:', boxX + 20, boxY + 165);
    doc.text(`${totalTTC.toFixed(2)} CHF`, boxX + boxWidth - 100, boxY + 165, { align: 'right' });
  }

  // Function to add the payment instructions
  function addPaymentInstructions() {
    const y = 380;
    
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Instructions de paiement', 50, y, { align: 'center' });
    
    doc.font('Helvetica').fontSize(10);
    doc.text('Veuillez utiliser le bulletin de paiement ci-dessous pour effectuer votre règlement.', 50, y + 25, { align: 'center' });
    doc.text('Délai de paiement: 30 jours', 50, y + 45, { align: 'center' });
    doc.text('Merci pour votre confiance.', 50, y + 65, { align: 'center' });
  }

  // Function to add the payment slip
  function addPaymentSlip() {
    // Get the path to the receipt image
    const rootDir = path.resolve(__dirname, '..');
    const receiptImagePath = path.join(rootDir, 'public', 'images', 'logo', 'recepisse.png');
    
    // Calculate image size to fit at the bottom of the page
    const pageWidth = doc.page.width;
    const receiptImageWidth = pageWidth; // Full page width
    
    // Calculate approximate height based on image aspect ratio
    const receiptAspectRatio = 1.8; // Width:Height ratio
    const receiptImageHeight = receiptImageWidth / receiptAspectRatio;
    
    // Position the receipt at the bottom of the page
    const receiptYPosition = doc.page.height - receiptImageHeight - 10;
    
    // Add a separator line
    doc.lineWidth(0.5);
    doc.moveTo(0, receiptYPosition - 10).lineTo(pageWidth, receiptYPosition - 10).stroke();
    
    // Insert the receipt image
    doc.image(receiptImagePath, 0, receiptYPosition, { 
      width: receiptImageWidth,
      align: 'center'
    });
  }

  // Generate the total page
  addTotalPageHeader();
  addTotalSection();
  addPaymentInstructions();
  addPaymentSlip();
}

module.exports = {
  generateInvoiceTotalPage
};