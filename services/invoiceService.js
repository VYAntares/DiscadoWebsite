// services/invoiceService.js
// Assurez-vous que ce fichier existe et est correctement configuré

const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

/**
 * Generates a PDF invoice with payment slip
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Array} orderItems - List of items in the order
 * @param {Object} userProfile - Customer profile information
 * @param {Date} orderDate - Date of the order
 * @param {String} orderId - Order identifier
 * @returns {Promise<void>}
 */
async function generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId) {
  // Ajouter une nouvelle page pour la facture
  doc.addPage();
  
  // Function to add a header element with reduced line spacing
  function addHeaderElement(text, x, y, options = {}) {
    doc.font('Helvetica').fontSize(9).text(text, x, y, options);
  }

  // Invoice header with reduced spacing
  function addInvoiceHeader() {
    const rootDir = path.resolve(__dirname, '..');
    doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 35, { width: 90 });

    // Sender information - more compact with appropriate vertical spacing
    const senderY = 50; // Increased to add more space after logo
    const lineSpacing = 12; // Maintained for good readability
    
    addHeaderElement('Discado Sàrl', 50, senderY + lineSpacing * 1);
    addHeaderElement('Sevelin 4A', 50, senderY + lineSpacing * 2);
    addHeaderElement('1007 Lausanne', 50, senderY + lineSpacing * 3);
    addHeaderElement('+41 79 457 33 85', 50, senderY + lineSpacing * 4);
    addHeaderElement('discadoswiss@gmail.com', 50, senderY + lineSpacing * 5);
    addHeaderElement('TVA CHE-114.139.308', 50, senderY + lineSpacing * 8);

    // Client information - starting 5 lines BELOW sender info
    // Position client info 5 lines below sender start position
    const clientStartY = senderY + lineSpacing * 7; // 5 lines after the sender start + 1 empty line
    
    // Start client info (removing "To:" label)
    addHeaderElement(`${userProfile.firstName} ${userProfile.lastName}`, 350, clientStartY);
    addHeaderElement(userProfile.shopName, 350, clientStartY + lineSpacing * 1);
    addHeaderElement(userProfile.shopAddress || userProfile.address, 350, clientStartY + lineSpacing * 2);
    addHeaderElement(
      `${userProfile.shopZipCode || userProfile.postalCode} ${userProfile.shopCity || userProfile.city}`,
      350,
      clientStartY + lineSpacing * 3
    );

    // Invoice details - starting after both sender and client info sections
    const invoiceDate = orderDate;
    
    // Format the order ID if it doesn't already match our format
    let formattedOrderId = orderId;
    if (!orderId.match(/\d{4}-\d{4}/)) {
        // Extract date components from the order date
        const orderDateObj = new Date(orderDate);
        const year = orderDateObj.getFullYear().toString().slice(-2);
        const month = (orderDateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = orderDateObj.getDate().toString().padStart(2, '0');
        const hour = orderDateObj.getHours().toString().padStart(2, '0');
        
        formattedOrderId = `${year}${month}-${day}${hour}`;
    } else {
        // Si c'est déjà au format YYMM-DDHH mais contient "order", le supprimer
        formattedOrderId = formattedOrderId.replace('order ', '');
    }
    
    // Position title after the longer of the two sections (sender + 5 lines or client info)
    // Client info now starts 6 lines after sender, and has 4 lines, so ends at senderY + 10 lines
    const titleY = senderY + lineSpacing * 11; // This puts it after both sender and client info
    
    // Add the invoice title with the number
    doc.font('Helvetica-Bold').fontSize(14).text(`Facture ${formattedOrderId}`, 50, titleY + 5);
    // Move the date line down one position
    addHeaderElement(`Order processing date: ${invoiceDate.toLocaleDateString('Fr')}`, 50, titleY + 30);

    // Return position for table to start
    return titleY + 50; // Adjusted spacing
  }

  // Add table header - slightly reduced size
  function addTableHeader(yPosition) {
    // Column configuration
    const columns = [
      { title: 'Description',    width: 200, align: 'left' },
      { title: 'Quantity',       width:  70, align: 'center' },
      { title: 'Unit Price',     width: 100, align: 'right' },
      { title: 'Total',          width: 100, align: 'right' }
    ];

    // Starting X position
    let currentX = 50;

    // Table header
    doc.font('Helvetica-Bold').fontSize(9); // Reduced font size

    columns.forEach(col => {
      doc.text(col.title, currentX, yPosition, {
        width: col.width,
        align: col.align
      });
      currentX += col.width;
    });

    // Header separator line
    doc.lineWidth(1);
    const lineEnd = 50 + columns.reduce((sum, col) => sum + col.width, 0);
    doc.moveTo(50, yPosition + 15) // Reduced spacing
       .lineTo(lineEnd, yPosition + 15)
       .stroke();

    return { yPosition: yPosition + 20, columns, lineEnd }; // Reduced spacing after header
  }

  // Check if new page is needed
  function needsNewPage(currentYPos, requiredHeight = 40) { // Reduced minimum height
    return currentYPos + requiredHeight > doc.page.height - 40;
  }

  // Add a new page
  function addNewPage() {
    doc.addPage();
    return addTableHeader(40).yPosition; // Start higher on new pages
  }

  // Add invoice header
  let yPos = addInvoiceHeader();

  // Add table header
  const { yPosition, columns, lineEnd } = addTableHeader(yPos);
  yPos = yPosition;

  // Group items by category
  const groupedItems = {};
  orderItems.forEach(item => {
    const category = item.categorie || 'autres';
    if (!groupedItems[category]) {
      groupedItems[category] = [];
    }
    groupedItems[category].push(item);
  });

  // Add order items by category
  let totalHT = 0;
  
  // Sort categories alphabetically
  const sortedCategories = Object.keys(groupedItems).sort();
  
  for (const category of sortedCategories) {
    // Add category header
    if (needsNewPage(yPos, 25)) {
      yPos = addNewPage();
    }
    
    // Add category title
    doc.font('Helvetica-Bold').fontSize(10); // Reduced from 12
    doc.text(category.charAt(0).toUpperCase() + category.slice(1), 50, yPos);
    yPos += 15; // Reduced spacing
    
    // Add items in this category
    doc.font('Helvetica').fontSize(9); // Reduced from 10
    
    for (const item of groupedItems[category]) {
      // Check if new page needed
      if (needsNewPage(yPos, 25)) {
        yPos = addNewPage();
      }

      const itemTotal = parseFloat(item.prix) * item.quantity;
      totalHT += itemTotal;

      let xPos = 50;

      // Item name
      const textOptions = {
        width: columns[0].width,
        align: columns[0].align
      };
      
      const textHeight = doc.heightOfString(item.Nom, textOptions);
      const rowHeight = Math.max(textHeight, 15); // Reduced minimum height

      // Double-check page break
      if (needsNewPage(yPos, rowHeight)) {
        yPos = addNewPage();
      }

      doc.text(item.Nom, xPos, yPos, textOptions);
      xPos += columns[0].width;

      // Quantity
      doc.text(String(item.quantity), xPos, yPos, {
        width: columns[1].width,
        align: columns[1].align
      });
      xPos += columns[1].width;

      // Unit price
      doc.text(`${parseFloat(item.prix).toFixed(2)} CHF`, xPos, yPos, {
        width: columns[2].width,
        align: columns[2].align
      });
      xPos += columns[2].width;

      // Total
      doc.text(`${itemTotal.toFixed(2)} CHF`, xPos, yPos, {
        width: columns[3].width,
        align: columns[3].align
      });

      yPos += rowHeight + 8; // Reduced spacing between rows
    }
    
    // Add a small space after each category
    yPos += 5; // Reduced spacing between categories
  }

  // Calculations and totals
  const TVA = 0.081;
  const montantTVA = totalHT * TVA;
  const totalTTC = totalHT + montantTVA;

  // Check if new page needed for totals
  if (needsNewPage(yPos, 80)) {
    yPos = addNewPage();
  }

  // Separator line before totals
  doc.moveTo(50, yPos + 5)
     .lineTo(lineEnd, yPos + 5)
     .stroke();

  // Totals alignment
  doc.font('Helvetica-Bold').fontSize(9);

  const col3Start = 50 + columns[0].width + columns[1].width;
  const col4Start = col3Start + columns[2].width;

  // Subtotal
  yPos += 12; // Reduced spacing
  doc.text('SOUS-TOTAL HT', col3Start, yPos, {
    width: columns[2].width,
    align: 'right'
  });
  doc.text(`${totalHT.toFixed(2)} CHF`, col4Start, yPos, {
    width: columns[3].width,
    align: 'right'
  });

  // VAT
  yPos += 12; // Reduced spacing
  doc.text('TVA 8.1%', col3Start, yPos, {
    width: columns[2].width,
    align: 'right'
  });
  doc.text(`${montantTVA.toFixed(2)} CHF`, col4Start, yPos, {
    width: columns[3].width,
    align: 'right'
  });

  // Total
  yPos += 12; // Reduced spacing
  doc.text('TOTAL TTC', col3Start, yPos, {
    width: columns[2].width,
    align: 'right'
  });
  doc.text(`${totalTTC.toFixed(2)} CHF`, col4Start, yPos, {
    width: columns[3].width,
    align: 'right'
  });
  
  // Add payment terms on the same line as the total, aligned with items on the left
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('CONDITIONS DE PAIEMENT: net à 30 jours', 50, yPos, {
    width: columns[0].width + columns[1].width,
    align: 'left'
  });

  // =========================================
  // PAYMENT SLIP SECTION HANDLING
  // =========================================
  
  // Get the path to the receipt image
  const rootDir = path.resolve(__dirname, '..');
  const receiptImagePath = path.join(rootDir, 'public', 'images', 'logo', 'recepisse.png');
  
  // Set receipt image to fill page width with proper margins
  const pageWidth = doc.page.width;
  const pageMargin = 0; // No margins for the receipt
  const receiptImageWidth = pageWidth; // Full page width
  
  // Calculate approximate height based on image aspect ratio (assuming 1.8:1 ratio)
  const receiptAspectRatio = 1.8; // Width:Height ratio
  const receiptImageHeight = receiptImageWidth / receiptAspectRatio;
  
  // Check if there's enough space in the current page for the receipt
  const minBottomMargin = 0; // Minimize bottom margin to maximize space
  const spaceNeeded = receiptImageHeight + minBottomMargin;
  const spaceAvailable = doc.page.height - yPos;
  
  if (spaceAvailable >= spaceNeeded) {
    // There's enough space on current page
    // Calculate position to place receipt at the absolute bottom of the page
    const receiptYPosition = doc.page.height - receiptImageHeight;
    
    // Add a separator line
    doc.lineWidth(0.5);
    doc.moveTo(0, receiptYPosition - 10).lineTo(doc.page.width, receiptYPosition - 10).stroke();
    
    // Position the receipt at the very bottom of the page
    doc.image(receiptImagePath, 0, receiptYPosition, { 
      width: receiptImageWidth,
      align: 'center'
    });
  } else {
    // Not enough space, add a new page for receipt
    doc.addPage();
    
    // Position the receipt at the absolute bottom of the new page
    const receiptYPosition = doc.page.height - receiptImageHeight;
    
    // Insert the receipt image aligned to the bottom
    doc.image(receiptImagePath, 0, receiptYPosition, { 
      width: receiptImageWidth,
      align: 'center'
    });
  }
}

module.exports = {
  generateInvoicePDF
};