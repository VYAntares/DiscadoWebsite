// services/invoiceService.js
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

/**
 * Service unifié pour la génération de factures PDF complètes
 * Gère à la fois la page des articles et la page de récapitulatif
 */
class InvoiceService {
  /**
   * Génère une facture PDF complète avec gestion intelligente des pages
   * @param {PDFDocument} doc - Instance PDFKit
   * @param {Array} orderItems - Liste des articles commandés
   * @param {Object} userProfile - Informations du profil client
   * @param {Date} orderDate - Date de la commande
   * @param {String} orderId - Identifiant de la commande
   * @returns {Promise<Object>} - Retourne les totaux calculés
   */
  static async generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId) {
    // Vérifier que le document est vide avant de commencer
    // Ceci évite la duplication si la fonction est appelée plusieurs fois
    if (doc.page.content.length > 0) {
      // Si le document contient déjà du contenu, on le réinitialise
      doc = new PDFDocument({ autoFirstPage: true });
    }
    
    // Générer la première page avec la liste des articles et récupérer la position Y finale
    const { totals, finalYPosition } = await this.generateItemsPage(doc, orderItems, userProfile, orderDate, orderId);
    
    // Générer la page de récapitulatif (toujours sur une nouvelle page)
    doc.addPage();
    
    await this.generateTotalPage(doc, {
      ...totals,
      orderDate,
      orderId,
      userProfile
    });
    
    return totals;
  }

  /**
   * Formatte l'identifiant de commande selon le format standard
   * @param {String} orderId - Identifiant de commande brut
   * @param {Date} orderDate - Date de la commande
   * @returns {String} - Identifiant formatté
   */
  static formatOrderId(orderId, orderDate) {
    if (!orderId.match(/\d{4}-\d{4}/)) {
      const orderDateObj = new Date(orderDate);
      const year = orderDateObj.getFullYear().toString().slice(-2);
      const month = (orderDateObj.getMonth() + 1).toString().padStart(2, '0');
      const day = orderDateObj.getDate().toString().padStart(2, '0');
      const hour = orderDateObj.getHours().toString().padStart(2, '0');
      
      return `${year}${month}-${day}${hour}`;
    } else {
      return orderId.replace('order ', '');
    }
  }

  /**
   * Génère la première page de la facture avec la liste des articles
   * @private
   * @returns {Object} - Totaux calculés et position Y finale
   */
  static async generateItemsPage(doc, orderItems, userProfile, orderDate, orderId) {
    const addHeaderElement = (text, x, y, options = {}) => {
      doc.font('Helvetica').fontSize(9).text(text, x, y, options);
    };

    // En-tête de facture avec espacement réduit
    const addInvoiceHeader = () => {
      const rootDir = path.resolve(__dirname, '..');
      doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 35, { width: 90 });

      // Informations de l'expéditeur
      const senderY = 50;
      const lineSpacing = 12;
      
      addHeaderElement('Discado Sàrl', 50, senderY + lineSpacing * 1);
      addHeaderElement('Sevelin 4A', 50, senderY + lineSpacing * 2);
      addHeaderElement('1007 Lausanne', 50, senderY + lineSpacing * 3);
      addHeaderElement('+41 79 457 33 85', 50, senderY + lineSpacing * 4);
      addHeaderElement('discadoswiss@gmail.com', 50, senderY + lineSpacing * 5);
      addHeaderElement('TVA CHE-114.139.308', 50, senderY + lineSpacing * 8);

      // Informations du client
      const clientStartY = senderY + lineSpacing * 7;
      
      addHeaderElement(`${userProfile.firstName} ${userProfile.lastName}`, 350, clientStartY);
      addHeaderElement(userProfile.shopName, 350, clientStartY + lineSpacing * 1);
      addHeaderElement(userProfile.shopAddress || userProfile.address, 350, clientStartY + lineSpacing * 2);
      addHeaderElement(
        `${userProfile.shopZipCode || userProfile.postalCode} ${userProfile.shopCity || userProfile.city}`,
        350,
        clientStartY + lineSpacing * 3
      );

      // Détails de la facture
      const formattedOrderId = this.formatOrderId(orderId, orderDate);
      
      const titleY = senderY + lineSpacing * 11;
      
      doc.font('Helvetica-Bold').fontSize(14).text(`Facture ${formattedOrderId}`, 50, titleY + 5);
      doc.font('Helvetica-Oblique').fontSize(9).text('Pour le détail du montant total, veuillez consulter la dernière page.', 50, titleY + 25);
      addHeaderElement(`Invoice date: ${orderDate.toLocaleDateString('Fr')}`, 50, titleY + 40);

      return titleY + 60;
    };

    // Création du tableau structuré
    const createCompactTable = (startY) => {
      const columns = [
        { title: 'Description', width: 230, align: 'left' },
        { title: 'Quantity', width: 70, align: 'center' },
        { title: 'Unit Price', width: 100, align: 'right' },
        { title: 'Total', width: 100, align: 'right' }
      ];
      
      const tableX = 50;
      const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
      
      doc.rect(tableX, startY, tableWidth, 25).stroke();
      
      let currentX = tableX;
      doc.font('Helvetica-Bold').fontSize(10);
      
      columns.forEach((col, index) => {
        if (index > 0) {
          doc.moveTo(currentX, startY).lineTo(currentX, startY + 25).stroke();
        }
        
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
        tableWidth
      };
    };

    // Ajout d'une ligne au tableau
    const addTableRow = (item, category, rowY, isCategory = false, tableConfig) => {
      const { tableX, columns, tableWidth } = tableConfig;
      const rowHeight = 20;
      
      doc.rect(tableX, rowY, tableWidth, rowHeight).stroke();
      
      let currentX = tableX;
      
      if (isCategory) {
        doc.font('Helvetica-Bold').fontSize(9);
        doc.fillColor('#f0f0f0');
        doc.rect(tableX, rowY, tableWidth, rowHeight).fill();
        doc.fillColor('black');
        doc.text(category.charAt(0).toUpperCase() + category.slice(1), currentX + 5, rowY + 6, {
          width: tableWidth - 10
        });
      } else {
        doc.font('Helvetica').fontSize(9);
        
        doc.text(item.Nom, currentX + 5, rowY + 6, {
          width: columns[0].width - 10,
          align: columns[0].align
        });
        currentX += columns[0].width;
        
        doc.moveTo(currentX, rowY).lineTo(currentX, rowY + rowHeight).stroke();
        
        doc.text(String(item.quantity), currentX + 5, rowY + 6, {
          width: columns[1].width - 10,
          align: columns[1].align
        });
        currentX += columns[1].width;
        
        doc.moveTo(currentX, rowY).lineTo(currentX, rowY + rowHeight).stroke();
        
        doc.text(`${parseFloat(item.prix).toFixed(2)} CHF`, currentX + 5, rowY + 6, {
          width: columns[2].width - 10,
          align: columns[2].align
        });
        currentX += columns[2].width;
        
        doc.moveTo(currentX, rowY).lineTo(currentX, rowY + rowHeight).stroke();
        
        const itemTotal = parseFloat(item.prix) * item.quantity;
        doc.text(`${itemTotal.toFixed(2)} CHF`, currentX + 5, rowY + 6, {
          width: columns[3].width - 10,
          align: columns[3].align
        });
      }
      
      return rowY + rowHeight;
    };

    // Ajouter une nouvelle page avec tableau
    const addNewPage = () => {
      doc.addPage();
      return createCompactTable(40).yPosition;
    };

    // Vérifier si une nouvelle page est nécessaire
    const needsNewPage = (currentY, requiredHeight = 30) => {
      return currentY + requiredHeight > doc.page.height - 120;
    };

    // Début de la génération
    let yPos = addInvoiceHeader();
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
      if (needsNewPage(yPos)) {
        yPos = addNewPage();
      }
      
      yPos = addTableRow(null, category, yPos, true, tableConfig);
      
      for (const item of groupedItems[category]) {
        if (needsNewPage(yPos)) {
          yPos = addNewPage();
        }
        
        yPos = addTableRow(item, category, yPos, false, tableConfig);
        totalHT += parseFloat(item.prix) * item.quantity;
      }
    }
    
    // Note en bas de page
    yPos += 20;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Voir page suivante pour le montant total et le bulletin de paiement.', 50, yPos);
    
    // Calculs des totaux
    const TVA = 0.081;
    const montantTVA = totalHT * TVA;
    const totalTTC = totalHT + montantTVA;
    
    return {
      totals: {
        totalHT,
        montantTVA,
        totalTTC
      },
      finalYPosition: yPos // Retourner la position Y finale
    };
  }

  /**
   * Génère la page récapitulative de la facture
   * @private
   */
  static async generateTotalPage(doc, invoiceData) {
    const { totalHT, montantTVA, totalTTC, orderDate, orderId, userProfile } = invoiceData;
    
    // Formatage de l'ID de commande
    const formattedOrderId = this.formatOrderId(orderId, orderDate);

    // En-tête de la page récapitulative
    const addTotalPageHeader = () => {
      const rootDir = path.resolve(__dirname, '..');
      doc.image(path.join(rootDir, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 35, { width: 90 });
      
      doc.font('Helvetica-Bold').fontSize(16);
      doc.text(`Récapitulatif de la Facture ${formattedOrderId}`, 50, 100, { align: 'center' });
      
      doc.font('Helvetica').fontSize(10);
      doc.text(`Date: ${orderDate.toLocaleDateString('Fr')}`, 50, 130, { align: 'center' });
      
      doc.moveDown(2);
    };

    // Section des totaux
    const addTotalSection = () => {
      const boxWidth = 350;
      const boxHeight = 180;
      const boxX = (doc.page.width - boxWidth) / 2;
      const boxY = 180;
      
      doc.rect(boxX, boxY, boxWidth, boxHeight)
        .lineWidth(1)
        .stroke();
      
      doc.font('Helvetica-Bold').fontSize(14);
      doc.fillColor('#8B0000');
      doc.text('MONTANT TOTAL DE LA FACTURE', boxX + 20, boxY + 20, { 
        width: boxWidth - 40,
        align: 'center'
      });
      
      doc.fillColor('black');
      
      doc.fontSize(10).font('Helvetica');
      doc.text(`Client: ${userProfile.firstName} ${userProfile.lastName}`, boxX + 20, boxY + 60);
      doc.text(`${userProfile.shopName}`, boxX + 20, boxY + 75);
      
      doc.moveTo(boxX + 20, boxY + 100).lineTo(boxX + boxWidth - 20, boxY + 100).stroke();
      
      doc.fontSize(10).font('Helvetica');
      doc.text('Sous-total HT:', boxX + 20, boxY + 120);
      doc.text(`${totalHT.toFixed(2)} CHF`, boxX + boxWidth - 100, boxY + 120, { align: 'right' });
      
      doc.text('TVA (8.1%):', boxX + 20, boxY + 140);
      doc.text(`${montantTVA.toFixed(2)} CHF`, boxX + boxWidth - 100, boxY + 140, { align: 'right' });
      
      doc.moveTo(boxX + 20, boxY + 160).lineTo(boxX + boxWidth - 20, boxY + 160).stroke();
      
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('TOTAL TTC:', boxX + 20, boxY + 165);
      doc.text(`${totalTTC.toFixed(2)} CHF`, boxX + boxWidth - 100, boxY + 165, { align: 'right' });
    };

    // Instructions de paiement
    const addPaymentInstructions = () => {
      const y = 380;
      
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Instructions de paiement', 50, y, { align: 'center' });
      
      doc.font('Helvetica').fontSize(10);
      doc.text('Veuillez utiliser le bulletin de paiement ci-dessous pour effectuer votre règlement.', 50, y + 25, { align: 'center' });
      doc.text('Délai de paiement: 30 jours', 50, y + 45, { align: 'center' });
      doc.text('Merci pour votre confiance.', 50, y + 65, { align: 'center' });
    };

    // Bulletin de paiement
    const addPaymentSlip = () => {
      const rootDir = path.resolve(__dirname, '..');
      const receiptImagePath = path.join(rootDir, 'public', 'images', 'logo', 'recepisse.png');
      
      const pageWidth = doc.page.width;
      const receiptImageWidth = pageWidth;
      
      const receiptAspectRatio = 1.8;
      const receiptImageHeight = receiptImageWidth / receiptAspectRatio;
      
      const receiptYPosition = doc.page.height - receiptImageHeight - 10;
      
      doc.lineWidth(0.5);
      doc.moveTo(0, receiptYPosition - 10).lineTo(pageWidth, receiptYPosition - 10).stroke();
      
      // Empêcher le chevauchement en vérifiant si l'image a déjà été ajoutée
      // On utilise une propriété interne pour marquer l'image comme ajoutée
      if (!doc._receiptAdded) {
        doc.image(receiptImagePath, 0, receiptYPosition, { 
          width: receiptImageWidth,
          align: 'center'
        });
        doc._receiptAdded = true;
      }
    };

    // Générer la page récapitulative
    addTotalPageHeader();
    addTotalSection();
    addPaymentInstructions();
    addPaymentSlip();
  }
}

module.exports = {
  generateInvoicePDF: (doc, orderItems, userProfile, orderDate, orderId) => {
    // Assurer qu'on n'appelle la fonction qu'une seule fois
    if (!doc._invoiceGenerated) {
      doc._invoiceGenerated = true;
      return InvoiceService.generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId);
    } else {
      console.log('La génération de facture a déjà été effectuée pour ce document');
      return Promise.resolve({});
    }
  }
};