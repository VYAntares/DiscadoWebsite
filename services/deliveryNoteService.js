// services/deliveryNoteService.js
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { generateInvoicePDF } = require('./invoiceService');

/**
 * Generates a PDF delivery note - SIMPLIFIED VERSION WITHOUT PRICES
 * Then automatically generates an invoice as well
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Array} orderItems - List of items in the order
 * @param {Object} userProfile - Customer profile information
 * @param {Date} orderDate - Date of the order
 * @param {String} orderId - Order identifier (not displayed in simplified version)
 * @param {Array} remainingItems - Items to be delivered later (optional)
 * @returns {Promise<void>}
 */
async function generateDeliveryNotePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems = []) {
  // Function to add a header element with reduced line spacing
  function addHeaderElement(text, x, y, options = {}) {
    doc.font('Helvetica').fontSize(9).text(text, x, y, options);
  }

  // Delivery note header with reduced spacing
  function addDeliveryNoteHeader() {
    const rootDir = path.resolve(__dirname, '..');
    doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 35, { width: 90 });

    // Sender information
    const senderY = 50;
    const lineSpacing = 12;
    
    addHeaderElement('Discado Sàrl', 50, senderY + lineSpacing * 1);
    addHeaderElement('Sevelin 4A', 50, senderY + lineSpacing * 2);
    addHeaderElement('1007 Lausanne', 50, senderY + lineSpacing * 3);
    addHeaderElement('+41 79 457 33 85', 50, senderY + lineSpacing * 4);
    addHeaderElement('discadoswiss@gmail.com', 50, senderY + lineSpacing * 5);
    
    // Client information - now at the SAME level as sender (not offset vertically)
    const clientY = senderY;
    
    addHeaderElement(`${userProfile.firstName} ${userProfile.lastName}`, 350, clientY + lineSpacing * 1);
    addHeaderElement(userProfile.shopName, 350, clientY + lineSpacing * 2);
    addHeaderElement(userProfile.shopAddress || userProfile.address, 350, clientY + lineSpacing * 3);
    addHeaderElement(
      `${userProfile.shopZipCode || userProfile.postalCode} ${userProfile.shopCity || userProfile.city}`,
      350,
      clientY + lineSpacing * 4
    );

    // Determine position for title (after both sender and client info sections)
    // Now positioned after the longer of the two columns
    const titleY = senderY + lineSpacing * 8; // Adjusted position
    
    // Add the delivery note title WITHOUT number
    doc.font('Helvetica-Bold').fontSize(14).text('Delivery Note', 50, titleY + 5);
    
    // Add the date under the title
    addHeaderElement(`Order processing date: ${deliveryDate.toLocaleDateString('Fr')}`, 50, titleY + 30);

    // Return position for table to start
    return titleY + 50;
  }

  // Add table header - SIMPLIFIED VERSION WITHOUT PRICES
  function addTableHeader(yPosition) {
    // Column configuration - ONLY DESCRIPTION AND QUANTITY
    const columns = [
      { title: 'Description', width: 350, align: 'left' },
      { title: 'Quantity',    width: 100, align: 'center' }
    ];

    // Starting X position
    let currentX = 50;

    // Table header
    doc.font('Helvetica-Bold').fontSize(9);

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
    doc.moveTo(50, yPosition + 15)
       .lineTo(lineEnd, yPosition + 15)
       .stroke();

    return { yPosition: yPosition + 20, columns, lineEnd };
  }

  // Check if new page is needed
  function needsNewPage(currentYPos, requiredHeight = 40) {
    return currentYPos + requiredHeight > doc.page.height - 40;
  }

  // Add a new page
  function addNewPage() {
    doc.addPage();
    return addTableHeader(40).yPosition;
  }

  // Set the delivery date
  const deliveryDate = orderDate;
  
  // Add delivery note header
  let yPos = addDeliveryNoteHeader();

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

  // Sort categories alphabetically
  const sortedCategories = Object.keys(groupedItems).sort();
  
  for (const category of sortedCategories) {
    // Add category header
    if (needsNewPage(yPos, 25)) {
      yPos = addNewPage();
    }
    
    // Add category title
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(category.charAt(0).toUpperCase() + category.slice(1), 50, yPos);
    yPos += 15;
    
    // Add items in this category
    doc.font('Helvetica').fontSize(9);
    
    for (const item of groupedItems[category]) {
      // Check if new page needed
      if (needsNewPage(yPos, 25)) {
        yPos = addNewPage();
      }

      let xPos = 50;

      // Item name
      const textOptions = {
        width: columns[0].width,
        align: columns[0].align
      };
      
      const textHeight = doc.heightOfString(item.Nom, textOptions);
      const rowHeight = Math.max(textHeight, 15);

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

      yPos += rowHeight + 8;
    }
    
    // Add a small space after each category
    yPos += 5;
  }
  
  // Process remaining items section
  if (remainingItems && remainingItems.length > 0) {
    // Add space before displaying remaining items
    yPos += 25;
    
    // Check if enough space for the remaining items section
    if (needsNewPage(yPos, 60)) {
      doc.addPage();
      yPos = 40;
    }
    
    // Title
    doc.font('Helvetica-Bold').fontSize(14).text('Items to be delivered later', 50, yPos);
    yPos += 20;
    doc.font('Helvetica').fontSize(9).text('The following items from your order will be delivered at a later date.', 50, yPos);
    yPos += 20;
    
    // Table header for remaining items
    const toDeliverTable = addTableHeader(yPos);
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
      if (needsNewPage(toDeliverYPos, 25)) {
        doc.addPage();
        const newHeader = addTableHeader(40);
        toDeliverYPos = newHeader.yPosition;
      }
      
      // Add category title
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text(category.charAt(0).toUpperCase() + category.slice(1), 50, toDeliverYPos);
      toDeliverYPos += 15;
      
      // Add items in this category
      doc.font('Helvetica').fontSize(9);
      
      for (const item of groupedRemainingItems[category]) {
        if (needsNewPage(toDeliverYPos, 25)) {
          doc.addPage();
          const newHeader = addTableHeader(40);
          toDeliverYPos = newHeader.yPosition;
        }
        
        let xPos = 50;
        
        // Item name
        const textOptions = {
          width: toDeliverTable.columns[0].width,
          align: toDeliverTable.columns[0].align
        };
        
        const textHeight = doc.heightOfString(item.Nom, textOptions);
        const rowHeight = Math.max(textHeight, 15);
        
        if (needsNewPage(toDeliverYPos, rowHeight)) {
          doc.addPage();
          const newHeader = addTableHeader(40);
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
        
        toDeliverYPos += rowHeight + 8;
      }
      
      // Add a small space after each category
      toDeliverYPos += 5;
    }
    
    // Note
    if (needsNewPage(toDeliverYPos, 25)) {
      doc.addPage();
      toDeliverYPos = 40;
    }
    
    toDeliverYPos += 20;
    doc.font('Helvetica').fontSize(9);
    doc.text('These items will be delivered as soon as they are available in stock.', 50, toDeliverYPos, { align: 'center', width: doc.page.width - 100 });
  }

  // After generating delivery note, add a page break and generate the invoice
  doc.addPage();
  await generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId);
}

module.exports = {
  generateDeliveryNotePDF
};