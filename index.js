const express = require('express');
const session = require('express-session');
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

// Lancement du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log(`Accessible sur le réseau à l'adresse http://192.168.1.252:${PORT}`);
});