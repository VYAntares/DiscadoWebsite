const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = 3000;

// Pour parser les données des formulaires
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Permet de servir les fichiers statiques (CSS, JS, images)

// Configuration des sessions
app.use(session({
  secret: 'ton_secret_unique', // Remplace par une clé unique
  resave: false,
  saveUninitialized: true
}));

// Liste des utilisateurs avec rôles (exemple)
const allowedUsers = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'client', password: 'client123', role: 'client' },
  { username: '42', password: 'simon', role: 'client'}
];

// Route de login
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/catalog');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = allowedUsers.find(u => u.username === username && u.password === password);
  if (user) {
    req.session.user = user;
    return res.redirect(user.role === 'admin' ? '/admin' : '/catalog');
  }
  res.send('Identifiants incorrects. <a href="/">Réessayer</a>');
});

// Middleware pour vérifier la connexion
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}

// Middleware spécifique pour admin
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.send('Accès refusé. <a href="/logout">Se déconnecter</a>');
}

// Route pour le catalogue client
app.get('/catalog', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'catalog.html'));
});

// Route pour l'interface admin
app.get('/admin', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Route pour se déconnecter
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.send('Erreur lors de la déconnexion.');
    res.redirect('/');
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
          // Augmenter le nombre maximum de colonnes pour gérer les points-virgules supplémentaires
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

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
