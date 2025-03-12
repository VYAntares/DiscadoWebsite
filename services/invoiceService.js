// services/invoiceService.js
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { generateInvoiceTotalPage } = require('./invoiceTotalService');

/**
 * Generates a PDF invoice with items list and separate total page
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {Array} orderItems - List of items in the order
 * @param {Object} userProfile - Customer profile information
 * @param {Date} orderDate - Date of the order
 * @param {String} orderId - Order identifier
 * @returns {Promise<Object>} - Returns calculation totals for the total page
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
    const titleY = senderY + lineSpacing * 11; // This puts it after both sender and client info
    
    // Add the invoice title with the number
    doc.font('Helvetica-Bold').fontSize(14).text(`Facture ${formattedOrderId}`, 50, titleY + 5);
    // Add info about total being on last page
    doc.font('Helvetica-Oblique').fontSize(9).text('Pour le détail du montant total, veuillez consulter la dernière page.', 50, titleY + 25);
    // Move the date line down one position
    addHeaderElement(`Invoice date: ${invoiceDate.toLocaleDateString('Fr')}`, 50, titleY + 40);

    // Return position for table to start
    return titleY + 60; // Adjusted spacing
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
  
  // Ajouter une note en bas de page indiquant que le total est sur la dernière page
  yPos += 20;
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Voir page suivante pour le montant total et le bulletin de paiement.', 50, yPos);

  // Calculs pour les totaux
  const TVA = 0.081;
  const montantTVA = totalHT * TVA;
  const totalTTC = totalHT + montantTVA;
  
  // Ne pas ajouter de page ici, laissons invoiceTotalService s'en charger
  await generateInvoiceTotalPage(doc, {
    totalHT,
    montantTVA,
    totalTTC,
    orderDate,
    orderId,
    userProfile
  });

  // Retourner les totaux calculés
  return {
    totalHT,
    montantTVA,
    totalTTC
  };
}

module.exports = {
  generateInvoicePDF
};