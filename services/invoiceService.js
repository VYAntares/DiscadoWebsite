// services/invoiceService.js
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const os = require('os');
const PDFDocument = require('pdfkit');

/**
 * Creates a QR code and returns the path to the file
 * @param {string} content - QR code content
 * @param {string} orderId - Order ID for unique filename
 * @returns {Promise<string>} - Path to the temporary QR code file
 */
async function createQRCode(content, orderId) {
  const tempFilePath = path.join(os.tmpdir(), `payment-qr-${orderId}-${Date.now()}.png`);
  
  return new Promise((resolve, reject) => {
    QRCode.toFile(tempFilePath, content, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 200,
      margin: 0
    }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(tempFilePath);
      }
    });
  });
}

/**
 * Generates a PDF invoice with payment slip - ASYNC VERSION
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Array} orderItems - List of items in the order
 * @param {Object} userProfile - Customer profile information
 * @param {Date} orderDate - Date of the order
 * @param {String} orderId - Order identifier
 * @param {Array} remainingItems - Items to be delivered later (optional)
 * @returns {Promise<void>}
 */
async function generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems = []) {
  // Function to add a header element
  function addHeaderElement(text, x, y, options = {}) {
    doc.font('Helvetica').fontSize(10).text(text, x, y, options);
  }

  // Page counter
  let pageCount = 0;
  const totalPages = calculateTotalPages(orderItems, remainingItems);
  
  // Function to calculate total pages
  function calculateTotalPages(items, remainingItems) {
    const itemsPerFirstPage = 10;
    const itemsPerPage = 15;
    
    let pages = 1;
    
    if (items.length > itemsPerFirstPage) {
      pages += Math.ceil((items.length - itemsPerFirstPage) / itemsPerPage);
    }
    
    if (remainingItems && remainingItems.length > 0) {
      pages += Math.ceil((remainingItems.length - itemsPerFirstPage) / itemsPerPage);
    }
    
    return pages;
  }
  
  // Function to add page number
  function addPageNumber() {
    pageCount++;
    doc.font('Helvetica').fontSize(8);
    doc.text(
      `Page ${pageCount}/${totalPages}`,
      doc.page.width - 50,
      doc.page.height - 20,
      { align: 'right' }
    );
  }

  // Invoice header
  function addInvoiceHeader() {
    // Logo
    const rootDir = path.resolve(__dirname, '..');
    doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 45, { width: 100 });

    // Sender information
    addHeaderElement('Discado Sàrl', 50, 150);
    addHeaderElement('Sevelin 4A', 50, 165);
    addHeaderElement('1007 Lausanne', 50, 180);
    addHeaderElement('+41 79 457 33 85', 50, 195);
    addHeaderElement('discadoswiss@gmail.com', 50, 210);

    // Client information
    const clientY = 150;
    addHeaderElement('To:', 350, clientY);
    addHeaderElement(`${userProfile.firstName} ${userProfile.lastName}`, 350, clientY + 15);
    addHeaderElement(userProfile.shopName, 350, clientY + 30);
    addHeaderElement(userProfile.shopAddress || userProfile.address, 350, clientY + 45);
    addHeaderElement(
      `${userProfile.shopZipCode || userProfile.postalCode} ${userProfile.shopCity || userProfile.city}`,
      350,
      clientY + 60
    );

    // Invoice details
    const invoiceDate = orderDate;

    doc.font('Helvetica-Bold').fontSize(16).text('Delivery Note', 50, 250);
    addHeaderElement(`Order processing date: ${invoiceDate.toLocaleDateString('Fr')}`, 50, 280);

    return 350;
  }

  // Add table header
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
    doc.font('Helvetica-Bold').fontSize(10);

    columns.forEach(col => {
      doc.text(col.title, currentX, yPosition, {
        width: col.width,
        align: col.align
      });
      currentX += col.width;
    });

    // Header separator line
    doc.lineWidth(1.2);
    const lineEnd = 50 + columns.reduce((sum, col) => sum + col.width, 0);
    doc.moveTo(50, yPosition + 20)
       .lineTo(lineEnd, yPosition + 20)
       .stroke();

    return { yPosition: yPosition + 30, columns, lineEnd };
  }

  // Check if new page is needed
  function needsNewPage(currentYPos, requiredHeight = 50) {
    return currentYPos + requiredHeight > doc.page.height - 40;
  }

  // Add a new page
  function addNewPage() {
    addPageNumber();
    doc.addPage();
    return addTableHeader(50).yPosition;
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
    if (needsNewPage(yPos, 30)) {
      yPos = addNewPage();
    }
    
    // Add category title
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(category.charAt(0).toUpperCase() + category.slice(1), 50, yPos);
    yPos += 20;
    
    // Add items in this category
    doc.font('Helvetica').fontSize(10);
    
    for (const item of groupedItems[category]) {
      // Check if new page needed
      if (needsNewPage(yPos, 30)) {
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
      const rowHeight = Math.max(textHeight, 20);

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

      yPos += rowHeight + 10;
    }
    
    // Add a small space after each category
    yPos += 10;
  }

  // Calculations and totals
  const TVA = 0.081;
  const montantTVA = totalHT * TVA;
  const totalTTC = totalHT + montantTVA;

  // Check if new page needed for totals
  if (needsNewPage(yPos, 100)) {
    yPos = addNewPage();
  }

  // Separator line before totals
  doc.moveTo(50, yPos + 5)
     .lineTo(lineEnd, yPos + 5)
     .stroke();

  // Totals alignment
  doc.font('Helvetica-Bold').fontSize(10);

  const col3Start = 50 + columns[0].width + columns[1].width;
  const col4Start = col3Start + columns[2].width;

  // Subtotal
  yPos += 15;
  doc.text('SUBTOTAL', col3Start, yPos, {
    width: columns[2].width,
    align: 'right'
  });
  doc.text(`${totalHT.toFixed(2)} CHF`, col4Start, yPos, {
    width: columns[3].width,
    align: 'right'
  });

  // VAT
  yPos += 15;
  doc.text('VAT 8.1%', col3Start, yPos, {
    width: columns[2].width,
    align: 'right'
  });
  doc.text(`${montantTVA.toFixed(2)} CHF`, col4Start, yPos, {
    width: columns[3].width,
    align: 'right'
  });

  // Total
  yPos += 15;
  doc.text('TOTAL', col3Start, yPos, {
    width: columns[2].width,
    align: 'right'
  });
  doc.text(`${totalTTC.toFixed(2)} CHF`, col4Start, yPos, {
    width: columns[3].width,
    align: 'right'
  });

  // Footer
  yPos += 25;
  doc.font('Helvetica').fontSize(10);
  doc.text('Thank you for your order!', 50, yPos, { align: 'center', width: doc.page.width - 100 });
  
  // Add page number
  addPageNumber();
  
  // =========================================
  // ADD PAYMENT SLIP SECTION ON A NEW PAGE
  // =========================================
  doc.addPage();
  
  // Swiss QR code content
  const qrContent = `SPC\n0200\n1\CH2380808009929375493\nS\nDISCADO Sàrl\nSévelin 4A\n1007\nLausanne\nCH\n\n\n\n\n\n\n\nCHF\n\n\n\n\n\n\n\nNON\n\n\nEPD\n`;
  
  // Generate QR code file (this is async)
  const qrCodePath = await createQRCode(qrContent, orderId);
  
  // Title: Récépissé
  doc.font('Helvetica-Bold').fontSize(12).text('Récépissé', 50, 50);
  
//   Left column: Account details
  doc.font('Helvetica').fontSize(10);
  doc.text('Compte / Payable à', 50, 80);
  doc.text('CH23 8080 8009 9293 7549 3', 50, 95);
  doc.text('DISCADO Sàrl', 50, 110);
  doc.text('Sévelin 4A', 50, 125);
  doc.text('1007 Lausanne', 50, 140);
  
  doc.text('Payable par (nom/adresse)', 50, 165);
  
  // Draw left column rectangle for payee info
  doc.rect(50, 180, 110, 80).stroke();
  
  // Currency and amount left
  doc.text('Monnaie', 50, 280);
  doc.text('CHF', 50, 295);
  
  doc.text('Montant', 110, 280);
  
  // Draw left column rectangle for amount
  doc.rect(110, 295, 50, 20).stroke();
  
  // Point de dépôt text
  doc.fontSize(8).text('Point de dépôt', 50, 330);
  
  // Middle section: Section paiement
  doc.fontSize(12).text('Section paiement', 230, 50);
  
  // Add QR code in the middle
  doc.image(qrCodePath, 230, 80, { width: 200 });
  
  // Middle section currency and amount
  doc.fontSize(10).text('Monnaie', 230, 295);
  doc.text('CHF', 230, 310);
  
  doc.text('Montant', 290, 295);
  
  // Draw rectangle for amount
  doc.rect(290, 310, 60, 20).stroke();
  
//   // Right column: duplicated account info
//   doc.text('Compte / Payable à', 400, 50);
//   doc.text('CH23 8080 8009 9293 7549 3', 400, 65);
//   doc.text('DISCADO Sàrl', 400, 80);
//   doc.text('Sévelin 4A', 400, 95);
//   doc.text('1007 Lausanne', 400, 110);
  
//   doc.text('Payable par (nom/adresse)', 400, 140);
  
//   // Draw right column rectangle for payee info
//   doc.rect(400, 155, 110, 80).stroke();
  
  // Add page number
  addPageNumber();
  
  // Clean up temporary file - try to delete it but don't worry if it fails
  try {
    fs.unlinkSync(qrCodePath);
  } catch (err) {
    // Ignore errors on cleanup
  }
  
  // =========================================
  // ITEMS TO BE DELIVERED SECTION (if applicable)
  // =========================================
  if (remainingItems && remainingItems.length > 0) {
    doc.addPage();
    
    // Title
    doc.font('Helvetica-Bold').fontSize(16).text('Items to be delivered later', 50, 50);
    doc.font('Helvetica').fontSize(10).text('The following items from your order will be delivered at a later date.', 50, 80);
    
    // Table header
    const toDeliverTable = addTableHeader(120);
    let toDeliverYPos = toDeliverTable.yPosition;
    
    // Group remaining items by category
    const groupedRemainingItems = {};
    remainingItems.forEach(item => {
      const category = item.categorie || 'autres';
      if (!groupedRemainingItems[category]) {
        groupedRemainingItems[category] = [];
      }
      groupedRemainingItems[category].push(item);
    });
    
    // Sort remaining categories alphabetically
    const sortedRemainingCategories = Object.keys(groupedRemainingItems).sort();
    
    // Process remaining items by category
    for (const category of sortedRemainingCategories) {
      // Add category header
      if (needsNewPage(toDeliverYPos, 30)) {
        addPageNumber();
        doc.addPage();
        const newHeader = addTableHeader(50);
        toDeliverYPos = newHeader.yPosition;
      }
      
      // Add category title
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text(category.charAt(0).toUpperCase() + category.slice(1), 50, toDeliverYPos);
      toDeliverYPos += 20;
      
      // Add items in this category
      doc.font('Helvetica').fontSize(10);
      
      for (const item of groupedRemainingItems[category]) {
        if (needsNewPage(toDeliverYPos, 30)) {
          addPageNumber();
          doc.addPage();
          const newHeader = addTableHeader(50);
          toDeliverYPos = newHeader.yPosition;
        }
        
        const itemTotal = parseFloat(item.prix) * item.quantity;
        
        let xPos = 50;
        
        // Item name
        const textOptions = {
          width: toDeliverTable.columns[0].width,
          align: toDeliverTable.columns[0].align
        };
        
        const textHeight = doc.heightOfString(item.Nom, textOptions);
        const rowHeight = Math.max(textHeight, 20);
        
        if (needsNewPage(toDeliverYPos, rowHeight)) {
          addPageNumber();
          doc.addPage();
          const newHeader = addTableHeader(50);
          toDeliverYPos = newHeader.yPosition;
        }
        
        // Item name
        doc.text(item.Nom, xPos, toDeliverYPos, textOptions);
        xPos += toDeliverTable.columns[0].width;
        
        // Quantity
        doc.text(String(item.quantity), xPos, toDeliverYPos, {
          width: toDeliverTable.columns[1].width,
          align: toDeliverTable.columns[1].align
        });
        xPos += toDeliverTable.columns[1].width;
        
        // Unit price
        doc.text(`${parseFloat(item.prix).toFixed(2)} CHF`, xPos, toDeliverYPos, {
          width: toDeliverTable.columns[2].width,
          align: toDeliverTable.columns[2].align
        });
        xPos += toDeliverTable.columns[2].width;
        
        // Total
        doc.text(`${itemTotal.toFixed(2)} CHF`, xPos, toDeliverYPos, {
          width: toDeliverTable.columns[3].width,
          align: toDeliverTable.columns[3].align
        });
        
        toDeliverYPos += rowHeight + 10;
      }
      
      // Add a small space after each category
      toDeliverYPos += 10;
    }
    
    // Note
    if (needsNewPage(toDeliverYPos, 30)) {
      addPageNumber();
      doc.addPage();
      toDeliverYPos = 50;
    }
    
    toDeliverYPos += 30;
    doc.font('Helvetica').fontSize(10);
    doc.text('These items will be delivered as soon as they are available in stock.', 50, toDeliverYPos, { align: 'center', width: doc.page.width - 100 });
    
    // Add page number to last page
    addPageNumber();
  }
}

module.exports = {
  generateInvoicePDF
};