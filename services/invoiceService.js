// services/invoiceService.js
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
    addHeaderElement(`Invoice date: ${invoiceDate.toLocaleDateString('Fr')}`, 50, titleY + 30);

    // Return position for table to start
    return titleY + 50; // Adjusted spacing
  }

  // Fonction améliorée pour créer un tableau bien structuré
  function createCompactTable(startY) {
    // Configuration des colonnes
    const columns = [
      { title: 'Description', width: 230, align: 'left' },
      { title: 'Quantity', width: 70, align: 'center' },
      { title: 'Unit Price', width: 100, align: 'right' },
      { title: 'Total', width: 100, align: 'right' }
    ];
    
    const tableX = 50;
    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const tableRight = tableX + tableWidth;
    
    // Dessiner le cadre extérieur du tableau
    doc.rect(tableX, startY, tableWidth, 25).stroke();
    
    // Entêtes de colonnes
    let currentX = tableX;
    doc.font('Helvetica-Bold').fontSize(10);
    
    columns.forEach((col, index) => {
      // Dessiner la séparation verticale (sauf pour la première colonne)
      if (index > 0) {
        doc.moveTo(currentX, startY).lineTo(currentX, startY + 25).stroke();
      }
      
      // Ajouter le titre de la colonne
      doc.text(col.title, currentX + 5, startY + 8, {
        width: col.width - 10,
        align: col.align
      });
      
      currentX += col.width;
    });
    
    return { 
      yPosition: startY + 25, 
      columns, 
      tableX, 
      tableWidth, 
      tableRight 
    };
  }

  // Fonction pour ajouter une ligne au tableau
  function addTableRow(item, category, rowY, isCategory = false) {
    const { tableX, columns, tableWidth } = tableConfig;
    const rowHeight = 20;
    
    // Rectangle pour la ligne
    doc.rect(tableX, rowY, tableWidth, rowHeight).stroke();
    
    // Contenu de la ligne
    let currentX = tableX;
    
    if (isCategory) {
      // Ligne de catégorie
      doc.font('Helvetica-Bold').fontSize(9);
      doc.fillColor('#f0f0f0');
      doc.rect(tableX, rowY, tableWidth, rowHeight).fill();
      doc.fillColor('black');
      doc.text(category.charAt(0).toUpperCase() + category.slice(1), currentX + 5, rowY + 6, {
        width: tableWidth - 10
      });
    } else {
      doc.font('Helvetica').fontSize(9);
      
      // Description du produit
      doc.text(item.Nom, currentX + 5, rowY + 6, {
        width: columns[0].width - 10,
        align: columns[0].align
      });
      currentX += columns[0].width;
      
      // Ligne verticale après la description
      doc.moveTo(currentX, rowY).lineTo(currentX, rowY + rowHeight).stroke();
      
      // Quantité
      doc.text(String(item.quantity), currentX + 5, rowY + 6, {
        width: columns[1].width - 10,
        align: columns[1].align
      });
      currentX += columns[1].width;
      
      // Ligne verticale après la quantité
      doc.moveTo(currentX, rowY).lineTo(currentX, rowY + rowHeight).stroke();
      
      // Prix unitaire
      doc.text(`${parseFloat(item.prix).toFixed(2)} CHF`, currentX + 5, rowY + 6, {
        width: columns[2].width - 10,
        align: columns[2].align
      });
      currentX += columns[2].width;
      
      // Ligne verticale après le prix unitaire
      doc.moveTo(currentX, rowY).lineTo(currentX, rowY + rowHeight).stroke();
      
      // Total
      const itemTotal = parseFloat(item.prix) * item.quantity;
      doc.text(`${itemTotal.toFixed(2)} CHF`, currentX + 5, rowY + 6, {
        width: columns[3].width - 10,
        align: columns[3].align
      });
    }
    
    return rowY + rowHeight;
  }

  // Fonction pour ajouter une nouvelle page avec tableau
  function addNewPage() {
    doc.addPage();
    return createCompactTable(40).yPosition;
  }

  // Vérifier si une nouvelle page est nécessaire
  function needsNewPage(currentY, requiredHeight = 30) {
    return currentY + requiredHeight > doc.page.height - 120;
  }

  // Ajouter l'en-tête de la facture
  let yPos = addInvoiceHeader();
  
  // Créer le tableau avec en-têtes
  const tableConfig = createCompactTable(yPos);
  yPos = tableConfig.yPosition;
  
  // Grouper les articles par catégorie
  const groupedItems = {};
  orderItems.forEach(item => {
    const category = item.categorie || 'autres';
    if (!groupedItems[category]) {
      groupedItems[category] = [];
    }
    groupedItems[category].push(item);
  });
  
  // Ajouter les articles au tableau par catégorie
  let totalHT = 0;
  const sortedCategories = Object.keys(groupedItems).sort();
  
  for (const category of sortedCategories) {
    // Vérifier s'il faut une nouvelle page pour la catégorie
    if (needsNewPage(yPos)) {
      yPos = addNewPage();
    }
    
    // Ajouter l'en-tête de catégorie
    yPos = addTableRow(null, category, yPos, true);
    
    // Ajouter les articles de cette catégorie
    for (const item of groupedItems[category]) {
      // Vérifier s'il faut une nouvelle page
      if (needsNewPage(yPos)) {
        yPos = addNewPage();
      }
      
      // Ajouter la ligne de l'article
      yPos = addTableRow(item, category, yPos);
      
      // Calculer le total
      totalHT += parseFloat(item.prix) * item.quantity;
    }
  }
  
  // Calculs et totaux
  const TVA = 0.081;
  const montantTVA = totalHT * TVA;
  const totalTTC = totalHT + montantTVA;
  
  // Vérifier s'il faut une nouvelle page pour les totaux
  if (needsNewPage(yPos, 80)) {
    yPos = addNewPage();
  }
  
  // Section des totaux
  const totalsX = tableConfig.tableRight - 200;
  const totalsWidth = 200;
  const rowHeight = 20;
  
  // Sous-total
  doc.rect(totalsX, yPos, totalsWidth, rowHeight).stroke();
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('SOUS-TOTAL HT', totalsX + 5, yPos + 6, {
    width: 100,
    align: 'left'
  });
  doc.text(`${totalHT.toFixed(2)} CHF`, totalsX + 105, yPos + 6, {
    width: 90,
    align: 'right'
  });
  yPos += rowHeight;
  
  // TVA
  doc.rect(totalsX, yPos, totalsWidth, rowHeight).stroke();
  doc.text('TVA 8.1%', totalsX + 5, yPos + 6, {
    width: 100,
    align: 'left'
  });
  doc.text(`${montantTVA.toFixed(2)} CHF`, totalsX + 105, yPos + 6, {
    width: 90,
    align: 'right'
  });
  yPos += rowHeight;
  
  // Total TTC et conditions de paiement sur la même ligne
  // Créer un rectangle pour toute la largeur du tableau
  doc.rect(tableConfig.tableX, yPos, tableConfig.tableWidth, rowHeight).stroke();
  
  // Zone pour les conditions de paiement (partie gauche)
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('CONDITIONS DE PAIEMENT: net à 30 jours', tableConfig.tableX + 5, yPos + 6, {
    width: tableConfig.tableWidth - totalsWidth - 10,
    align: 'left'
  });
  
  // Zone pour le total TTC (partie droite)
  doc.rect(totalsX, yPos, totalsWidth, rowHeight).stroke();
  doc.fillColor('#f0f0f0');
  doc.rect(totalsX, yPos, totalsWidth, rowHeight).fill();
  doc.fillColor('black');
  doc.text('TOTAL TTC', totalsX + 5, yPos + 6, {
    width: 100,
    align: 'left'
  });
  doc.text(`${totalTTC.toFixed(2)} CHF`, totalsX + 105, yPos + 6, {
    width: 90,
    align: 'right'
  });
  
  yPos += rowHeight + 10;
  
  // =========================================
  // PAYMENT SLIP SECTION
  // =========================================

  // Get the path to the receipt image
  const rootDir = path.resolve(__dirname, '..');
  const receiptImagePath = path.join(rootDir, 'public', 'images', 'logo', 'recepisse.png');

  // Set receipt image to fill page width with proper margins
  const pageWidth = doc.page.width;
  const receiptImageWidth = pageWidth; // Full page width

  // Calculate approximate height based on image aspect ratio (assuming 1.8:1 ratio)
  const receiptAspectRatio = 1.8; // Width:Height ratio
  const receiptImageHeight = receiptImageWidth / receiptAspectRatio;

  // Check if there's enough space in the current page for the receipt
  const minBottomMargin = 0; // Minimize bottom margin to maximize space
  const spaceNeeded = receiptImageHeight + minBottomMargin;
  const spaceAvailable = doc.page.height - yPos - 40; // Allowing some extra space

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

  // Add QRCode at the end of the document
  const qrCodeImagePath = path.join(rootDir, 'public', 'images', 'logo', 'qrcode.png');
  const qrCodeImageWidth = 100; // Adjust the width as needed

  // Add a new page for the QRCode if there isn't enough space
  if (doc.y + 150 > doc.page.height - 50) {
    doc.addPage();
  }

  // Add the QRCode image at the desired position
  doc.image(qrCodeImagePath, doc.page.width - qrCodeImageWidth - 50, doc.page.height - 150, { 
    width: qrCodeImageWidth 
  });
}

module.exports = {
  generateInvoicePDF
};