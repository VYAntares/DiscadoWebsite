// services/invoiceService.js
const path = require('path');
const fs = require('fs');
const os = require('os');
const PDFDocument = require('pdfkit');

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
  
  // Get the path to the existing QR code image
  const rootDir = path.resolve(__dirname, '..');
  const qrImagePath = path.join(rootDir, 'public', 'images', 'logo', 'qrcode.png');
  
  // Function to draw a complete payment slip (used for both top and bottom of page)
  function drawPaymentSlip(startY) {
    // Left column (Récépissé)
    doc.font('Helvetica-Bold').fontSize(12).text('Récépissé', 20, startY);
    
    // Left column: Account details
    doc.font('Helvetica').fontSize(9);
    doc.text('Compte / Payable à', 20, startY + 20);
    doc.text('CH23 8080 8009 9293 7549 3', 20, startY + 32);
    doc.text('DISCADO Sàrl', 20, startY + 44);
    doc.text('Sévelin 4A', 20, startY + 56);
    doc.text('1007 Lausanne', 20, startY + 68);
    
    doc.text('Payable par (nom/adresse)', 20, startY + 90);
    
    // Draw left column rectangle for payee info (L-bracket style)
    doc.lineWidth(0.5);
    // Draw L-bracket for payee info (top-left)
    doc.moveTo(20, startY + 105).lineTo(20, startY + 180).stroke();
    doc.moveTo(20, startY + 180).lineTo(130, startY + 180).stroke();
    
    // Draw L-bracket for payee info (bottom-right)
    doc.moveTo(130, startY + 105).lineTo(130, startY + 105).stroke();
    doc.moveTo(130, startY + 105).lineTo(130, startY + 180).stroke();
    
    // Currency and amount left
    doc.text('Monnaie', 20, startY + 190);
    doc.text('CHF', 20, startY + 205);
    
    doc.text('Montant', 70, startY + 190);
    
    // Draw rectangle L-bracket for amount
    doc.moveTo(70, startY + 205).lineTo(70, startY + 225).stroke();
    doc.moveTo(70, startY + 225).lineTo(130, startY + 225).stroke();
    
    doc.moveTo(130, startY + 205).lineTo(130, startY + 205).stroke();
    doc.moveTo(130, startY + 225).lineTo(130, startY + 205).stroke();
    
    // Point de dépôt text
    doc.fontSize(8).text('Point de dépôt', 20, startY + 235);
    
    // Middle section: Section paiement
    doc.fontSize(12).text('Section paiement', 220, startY);
    
    // Add QR code image in the middle
    doc.image(qrImagePath, 220, startY + 25, { width: 150 });
    
    // Middle section currency and amount
    doc.fontSize(9).text('Monnaie', 220, startY + 190);
    doc.text('CHF', 220, startY + 205);
    
    doc.text('Montant', 270, startY + 190);
    
    // Draw L-bracket for amount in middle section
    doc.moveTo(270, startY + 205).lineTo(270, startY + 225).stroke();
    doc.moveTo(270, startY + 225).lineTo(330, startY + 225).stroke();
    
    doc.moveTo(330, startY + 205).lineTo(330, startY + 205).stroke();
    doc.moveTo(330, startY + 225).lineTo(330, startY + 205).stroke();
    
    // Right column (Compte)
    doc.fontSize(9);
    doc.text('Compte / Payable à', 400, startY + 20);
    doc.text('CH23 8080 8009 9293 7549 3', 400, startY + 32);
    doc.text('DISCADO Sàrl', 400, startY + 44);
    doc.text('Sévelin 4A', 400, startY + 56);
    doc.text('1007 Lausanne', 400, startY + 68);
    
    doc.text('Payable par (nom/adresse)', 400, startY + 90);
    
    // Draw right column L-bracket for payee info
    doc.moveTo(400, startY + 105).lineTo(400, startY + 180).stroke();
    doc.moveTo(400, startY + 180).lineTo(510, startY + 180).stroke();
    
    doc.moveTo(510, startY + 105).lineTo(510, startY + 105).stroke();
    doc.moveTo(510, startY + 180).lineTo(510, startY + 105).stroke();
  }
  
  // Draw payment slip at the top of the page
  drawPaymentSlip(40);
  
  // Draw a separator line in the middle of the page
  doc.lineWidth(0.2);
  doc.moveTo(20, 320).lineTo(550, 320).dash(3, { space: 2 }).stroke();
  
  // Draw payment slip at the bottom of the page
  drawPaymentSlip(350);
  
  // Add page number
  addPageNumber();
  
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