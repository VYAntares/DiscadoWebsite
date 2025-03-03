const express = require('express');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour parser les données des formulaires et JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Servir les fichiers statiques
app.use(express.static('public'));

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'votre_secret_unique_ici', 
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// Liste des utilisateurs avec rôles (à remplacer par une base de données en production)
const allowedUsers = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'admin2', password: 'admin124', role: 'admin' },
  { username: 'client', password: 'client123', role: 'client' },
  { username: 'client2', password: 'client123', role: 'client' },
  { username: 'luca', password: 'lumattei', role: 'client' }
];

// Middleware pour vérifier la connexion
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}

// Middleware spécifique pour admin
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).send('Accès refusé');
}

// Vérifier si le profil est complet
function isProfileComplete(username) {
  const userProfilePath = `./data_client/${username}_profile.json`;
  
  if (!fs.existsSync(userProfilePath)) {
    return false;
  }
  
  try {
    const profileData = JSON.parse(fs.readFileSync(userProfilePath, 'utf8'));
    const requiredFields = [
      'firstName', 'lastName', 'email', 'phone', 
      'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
    ];
    return requiredFields.every(field => 
      profileData[field] && profileData[field].trim() !== ''
    );
  } catch (error) {
    console.error('Erreur lors de la lecture du profil:', error);
    return false;
  }
}

// Middleware pour vérifier le profil complet
function requireCompleteProfile(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  if (req.session.user.role === 'admin') {
    return next(); // Les administrateurs n'ont pas besoin de profil complet
  }
  
  if (!isProfileComplete(req.session.user.username)) {
    return res.redirect('/profile');
  }
  
  next();
}

// Routes principales
app.get('/', (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin');
    } else {
      if (isProfileComplete(req.session.user.username)) {
        return res.redirect('/catalog');
      } else {
        return res.redirect('/profile');
      }
    }
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route de connexion
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = allowedUsers.find(u => u.username === username && u.password === password);
  
  if (user) {
    req.session.user = user;
    
    if (user.role === 'admin') {
      return res.redirect('/admin');
    } else {
      if (isProfileComplete(user.username)) {
        return res.redirect('/catalog');
      } else {
        return res.redirect('/profile');
      }
    }
  }
  
  res.status(401).send('Identifiants incorrects. <a href="/">Réessayer</a>');
});

// Route de déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.send('Erreur lors de la déconnexion');
    res.redirect('/');
  });
});

// Routes protégées
app.get('/admin', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/catalog', requireLogin, requireCompleteProfile, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'catalog.html'));
});

app.get('/profile', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/orders', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'orders.html'));
});

// Routes API pour le profil
app.get('/api/user-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const userProfilePath = `./data_client/${userId}_profile.json`;
  
  if (fs.existsSync(userProfilePath)) {
    const fileContent = fs.readFileSync(userProfilePath, 'utf8');
    const profile = JSON.parse(fileContent);
    res.json(profile);
  } else {
    res.json({});
  }
});

app.post('/api/save-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profileData = req.body;
  
  // Ajouter un timestamp 
  profileData.lastUpdated = new Date().toISOString();
  
  // Créer le dossier data_client s'il n'existe pas
  const dataClientDir = path.join(__dirname, 'data_client');
  if (!fs.existsSync(dataClientDir)) {
    fs.mkdirSync(dataClientDir);
  }
  
  const userProfilePath = path.join(dataClientDir, `${userId}_profile.json`);
  
  // Sauvegarder le profil
  fs.writeFileSync(userProfilePath, JSON.stringify(profileData, null, 2));
  
  // Vérifier si le profil est complet
  const requiredFields = [
    'firstName', 'lastName', 'email', 'phone', 
    'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
  ];
  const isComplete = requiredFields.every(field => 
    profileData[field] && profileData[field].trim() !== ''
  );
  
  res.json({ 
    success: true, 
    message: 'Profil sauvegardé avec succès',
    isProfileComplete: isComplete 
  });
});

// Route API pour récupérer les produits depuis les fichiers CSV
app.get('/api/products', (req, res) => {
  const dataFolder = path.join(__dirname, 'data');
  fs.readdir(dataFolder, (err, files) => {
    if (err) {
      console.error("Erreur lors de la lecture du dossier:", err);
      return res.status(500).send("Erreur lors de la lecture du dossier data");
    }

    const csvFiles = files.filter(file => file.endsWith('.csv'));
    let products = [];
    let filesProcessed = 0;

    if (csvFiles.length === 0) return res.json(products);

    csvFiles.forEach(file => {
      const filePath = path.join(dataFolder, file);
      const categoryName = file.replace('.csv', ''); // Ex: "pens" pour "pens.csv"

      fs.createReadStream(filePath)
        .pipe(csv({ 
          separator: ';',
          maxRows: 0 
        }))
        .on('data', (row) => {
          // Ajouter la catégorie
          row.categorie = categoryName;
          
          // Trouver l'URL d'image parmi les propriétés
          let imageUrl = null;
          
          // Parcourir toutes les propriétés pour trouver une URL d'image valide
          Object.keys(row).forEach(key => {
            const value = row[key];
            if (typeof value === 'string' && 
                (value.includes('/images/') || 
                 value.includes('/public/images/'))) {
              imageUrl = value;
            }
          });
          
          // Nettoyer l'URL d'image si nécessaire
          if (imageUrl) {
            // Enlever le préfixe '/public' s'il existe
            imageUrl = imageUrl.replace('/public', '');
            
            // S'assurer que l'URL commence par '/'
            if (!imageUrl.startsWith('/')) {
              imageUrl = '/' + imageUrl;
            }
            
            row.imageUrl = imageUrl;
          } else {
            // Image par défaut si aucune URL n'est trouvée
            row.imageUrl = `/images/${categoryName}/${categoryName}-default.jpg`;
          }
          
          // Nettoyer l'objet en supprimant les propriétés numériques ou vides
          const cleanedRow = {};
          Object.keys(row).forEach(key => {
            // Ignorer les propriétés qui sont des indices numériques ou vides
            if (isNaN(parseInt(key)) && key !== '' && row[key] !== '') {
              cleanedRow[key] = row[key];
            }
          });
          
          products.push(cleanedRow);
        })
        .on('end', () => {
          filesProcessed++;
          if (filesProcessed === csvFiles.length) {
            res.json(products);
          }
        })
        .on('error', (error) => {
          console.error(`Erreur lors de la lecture du fichier ${file}:`, error);
          filesProcessed++;
          if (filesProcessed === csvFiles.length) {
            res.json(products);
          }
        });
    });
  });
});

// Route pour sauvegarder une commande
app.post('/api/save-order', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const cartItems = req.body.items;
  
  // Créer un objet commande
  const order = {
    userId: userId,
    items: cartItems,
    status: 'in progress',
    date: new Date().toISOString()
  };
  
  // Vérifier si l'utilisateur a déjà des commandes
  const dataStoreDir = path.join(__dirname, 'data_store');
  if (!fs.existsSync(dataStoreDir)) {
    fs.mkdirSync(dataStoreDir);
  }
  
  const userOrdersPath = path.join(dataStoreDir, `${userId}_orders.json`);
  let userOrders = [];
  
  if (fs.existsSync(userOrdersPath)) {
    // Lire le fichier existant
    const fileContent = fs.readFileSync(userOrdersPath, 'utf8');
    userOrders = JSON.parse(fileContent);
  }
  
  // Ajouter la nouvelle commande
  userOrders.push(order);
  
  // Sauvegarder dans le fichier
  fs.writeFileSync(userOrdersPath, JSON.stringify(userOrders, null, 2));
  
  res.json({ success: true, message: 'Commande enregistrée' });
});

// Route pour récupérer les commandes d'un utilisateur
app.get('/api/user-orders', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const userOrdersPath = path.join(__dirname, 'data_store', `${userId}_orders.json`);
  
  if (fs.existsSync(userOrdersPath)) {
    const fileContent = fs.readFileSync(userOrdersPath, 'utf8');
    const orders = JSON.parse(fileContent);
    res.json(orders);
  } else {
    res.json([]);
  }
});

// Configuration des répertoires de données
const dataDirs = ['./data_store', './data_client', './data'];
dataDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

app.get('/api/download-invoice/:orderId', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const orderId = parseInt(req.params.orderId, 10);
  const userProfilePath = path.join(__dirname, 'data_client', `${userId}_profile.json`);
  const ordersPath = path.join(__dirname, 'data_store', `${userId}_orders.json`);

  try {
    // Vérifier que le fichier de profil existe
    if (!fs.existsSync(userProfilePath)) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Lire le profil utilisateur
    const profileContent = fs.readFileSync(userProfilePath, 'utf8');
    const userProfile = JSON.parse(profileContent);

    // Lire les commandes de l'utilisateur
    const fileContent = fs.readFileSync(ordersPath, 'utf8');
    const orders = JSON.parse(fileContent);

    // Trouver la commande spécifique
    const order = orders[orderId];
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Créer un nouveau document PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    // Définir l'en-tête pour le téléchargement
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Invoice_${userId}_${new Date(order.date).toISOString().split('T')[0]}.pdf`
    );

    // Pipe du PDF directement dans la réponse
    doc.pipe(res);

    // Fonction pour ajouter un élément d'en-tête
    function addHeaderElement(doc, text, x, y, options = {}) {
      doc.font('Helvetica').fontSize(10).text(text, x, y, options);
    }

    // Logo de l'entreprise
    doc.image(path.join(__dirname, 'public', 'images', 'logo_discado_noir.png'), 50, 45, { width: 100 });

    // Informations de l'émetteur
    addHeaderElement(doc, 'Discado Sàrl', 50, 150);
    addHeaderElement(doc, 'Rue de Lausanne 7', 50, 165);
    addHeaderElement(doc, '1020 Morges, Suisse', 50, 180);
    addHeaderElement(doc, 'TVA : CHE-123.456.789', 50, 195);

    // Informations du client
    const clientY = 150;
    addHeaderElement(doc, 'Facture à :', 350, clientY);
    addHeaderElement(doc, `${userProfile.firstName} ${userProfile.lastName}`, 350, clientY + 15);
    addHeaderElement(doc, userProfile.shopName, 350, clientY + 30);
    addHeaderElement(doc, userProfile.shopAddress || userProfile.address, 350, clientY + 45);
    addHeaderElement(
      doc,
      `${userProfile.shopZipCode || userProfile.postalCode} ${userProfile.shopCity || userProfile.city}`,
      350,
      clientY + 60
    );

    // Détails de la facture
    const invoiceDate = new Date(order.date);
    const invoiceNumber = `INV-${invoiceDate.getFullYear()}-${(orderId + 1).toString().padStart(4, '0')}`;

    doc.font('Helvetica-Bold').fontSize(16).text('Facture', 50, 250);
    addHeaderElement(doc, `Numéro de facture: ${invoiceNumber}`, 50, 280);
    addHeaderElement(doc, `Date de facturation: ${invoiceDate.toLocaleDateString('fr-CH')}`, 50, 295);

    // Configuration des colonnes du tableau
    const tableTop = 350;
    const columns = [
      { title: 'Désignation',   width: 200, align: 'left' },
      { title: 'Quantité',     width:  70, align: 'center' },
      { title: 'Prix unitaire',width: 100, align: 'right' },
      { title: 'Total',        width: 100, align: 'right' }
    ];

    // Calcul de la largeur totale des colonnes
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

    // Position X de départ
    let currentX = 50;

    // En-tête du tableau
    doc.font('Helvetica-Bold').fontSize(10);

    columns.forEach(col => {
      doc.text(col.title, currentX, tableTop, {
        width: col.width,
        align: col.align
      });
      currentX += col.width;
    });

    // Épaisseur de trait
    doc.lineWidth(1.2);

    // Ligne séparatrice en-tête : on étend un peu plus loin que le total
    const lineEnd = 50 + totalWidth; // Ajustez le +30 pour aller un peu plus à droite
    doc.moveTo(50, tableTop + 20)
       .lineTo(lineEnd, tableTop + 20)
       .stroke();

    // Lignes d'articles
    let yPos = tableTop + 30;
    let totalHT = 0;

    order.items.forEach(item => {
      const itemTotal = parseFloat(item.prix) * item.quantity;
      totalHT += itemTotal;

      doc.font('Helvetica').fontSize(10);

      // On réinitialise la position de départ pour chaque ligne
      let xPos = 50;

      // Désignation
      doc.text(item.Nom, xPos, yPos, {
        width: columns[0].width,
        align: columns[0].align
      });
      xPos += columns[0].width;

      // Quantité
      doc.text(String(item.quantity), xPos, yPos, {
        width: columns[1].width,
        align: columns[1].align
      });
      xPos += columns[1].width;

      // Prix unitaire
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

      yPos += 20;
    });

    // Calculs et totaux
    const TVA = 0.077; // Taux de TVA suisse standard (7.7%)
    const montantTVA = totalHT * TVA;
    const totalTTC = totalHT + montantTVA;

    // Ligne séparatrice avant les totaux
    doc.moveTo(50, yPos + 10)
       .lineTo(lineEnd, yPos + 10)
       .stroke();

    // **Alignement des totaux** sous « Prix unitaire » et « Total »
    doc.font('Helvetica-Bold').fontSize(10);

    // On calcule la position de la troisième colonne (prix unitaire)
    // et de la quatrième (total).
    const col3Start = 50 + columns[0].width + columns[1].width; // début de la colonne 3
    const col4Start = col3Start + columns[2].width;             // début de la colonne 4

    // TOTaux (labels dans la 3e col, montants dans la 4e col)
    doc.text('TOTAL HT', col3Start, yPos + 20, {
      width: columns[2].width,
      align: 'right'
    });
    doc.text(`${totalHT.toFixed(2)} CHF`, col4Start, yPos + 20, {
      width: columns[3].width,
      align: 'right'
    });

    doc.text('TVA 7.7%', col3Start, yPos + 40, {
      width: columns[2].width,
      align: 'right'
    });
    doc.text(`${montantTVA.toFixed(2)} CHF`, col4Start, yPos + 40, {
      width: columns[3].width,
      align: 'right'
    });

    doc.text('TOTAL TTC', col3Start, yPos + 60, {
      width: columns[2].width,
      align: 'right'
    });
    doc.text(`${totalTTC.toFixed(2)} CHF`, col4Start, yPos + 60, {
      width: columns[3].width,
      align: 'right'
    });

    // Conditions de paiement
    doc.font('Helvetica').fontSize(10);
    doc.text('Conditions de paiement : Net 30 jours', 50, yPos + 120);
    doc.text('Veuillez effectuer le paiement par virement bancaire', 50, yPos + 135);

    // Pied de page
    doc.text('Merci pour votre commande !', 50, yPos + 180, { align: 'center' });

    // Finaliser le PDF
    doc.end();

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Could not generate invoice' });
  }
});

// Lancement du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log(`Accessible sur le réseau à l'adresse http://172.20.10.3:${PORT}`);
});