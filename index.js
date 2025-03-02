const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = 3000;

// Pour parser les données des formulaires
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
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
  { username: 'admin2', password: 'admin124', role: 'admin' },
  { username: 'client', password: 'client123', role: 'client' },
  { username: 'client2', password: 'client123', role: 'client' },
  { username: 'luca', password: 'lumattei', role: 'client' }
];

// Route de login
app.get('/', (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin');
    } else {
      // Pour les clients, vérifier le profil
      if (isProfileComplete(req.session.user.username)) {
        return res.redirect('/catalog');
      } else {
        return res.redirect('/profile');
      }
    }
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = allowedUsers.find(u => u.username === username && u.password === password);
  if (user) {
    req.session.user = user;
    
    if (user.role === 'admin') {
      return res.redirect('/admin');
    } else {
      // Pour les clients, vérifier le profil
      if (isProfileComplete(user.username)) {
        return res.redirect('/catalog');
      } else {
        return res.redirect('/profile');
      }
    }
  }
  res.send('Incorrect Identifier. <a href="/">Please retry.</a>');
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

// Fonction pour vérifier si un profil est complet
function isProfileComplete(username) {
  const userProfilePath = `./data_client/${username}_profile.json`;
  
  if (!fs.existsSync(userProfilePath)) {
    return false;
  }
  
  try {
    const profileData = JSON.parse(fs.readFileSync(userProfilePath, 'utf8'));
    const requiredFields = ['fullName', 'email', 'phone', 'address', 'city', 'postalCode'];
    return requiredFields.every(field => 
      profileData[field] && profileData[field].trim() !== ''
    );
  } catch (error) {
    console.error('Erreur lors de la lecture du profil:', error);
    return false;
  }
}

// Middleware pour vérifier si le profil est complet
function requireCompleteProfile(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  if (req.session.user.role === 'admin') {
    // Les administrateurs n'ont pas besoin de profil complet
    return next();
  }
  
  if (!isProfileComplete(req.session.user.username)) {
    return res.redirect('/profile');
  }
  
  next();
}

// Route pour le catalogue client
app.get('/catalog', requireLogin, requireCompleteProfile, (req, res) => {
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

// Route pour la page de profil
app.get('/profile', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

if (!fs.existsSync('./data_store')) {
  fs.mkdirSync('./data_store');
}

// Route pour récupérer le profil de l'utilisateur
app.get('/api/user-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const userProfilePath = `./data_client/${userId}_profile.json`;
  
  if (fs.existsSync(userProfilePath)) {
    const fileContent = fs.readFileSync(userProfilePath, 'utf8');
    const profile = JSON.parse(fileContent);
    res.json(profile);
  } else {
    // Retourner un objet vide si le profil n'existe pas encore
    res.json({});
  }
});

app.post('/api/save-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profileData = req.body;
  
  // Ajouter un timestamp pour suivre les mises à jour
  profileData.lastUpdated = new Date().toISOString();
  
  // Chemin du fichier de profil
  const userProfilePath = `./data_client/${userId}_profile.json`;
  
  // Sauvegarder le profil
  fs.writeFileSync(userProfilePath, JSON.stringify(profileData, null, 2));
  
  // Vérifier si le profil est complet
  const requiredFields = ['fullName', 'email', 'phone', 'address', 'city', 'postalCode'];
  const isComplete = requiredFields.every(field => 
    profileData[field] && profileData[field].trim() !== ''
  );
  
  res.json({ 
    success: true, 
    message: 'Profile saved successfully',
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

if (!fs.existsSync('./data_store')) {
  fs.mkdirSync('./data_store');
}

app.post('/api/save-order', requireLogin, (req, res) => {
  // Récupérer les informations de l'utilisateur et du panier
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
  const userOrdersPath = `./data_store/${userId}_orders.json`;
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
  const userOrdersPath = `./data_store/${userId}_orders.json`;
  
  if (fs.existsSync(userOrdersPath)) {
    const fileContent = fs.readFileSync(userOrdersPath, 'utf8');
    const orders = JSON.parse(fileContent);
    res.json(orders);
  } else {
    res.json([]);
  }
});

// Add these routes to your index.js file

// Add these routes to your index.js file

// Route to get all orders for admin
app.get('/api/admin/orders', requireLogin, requireAdmin, (req, res) => {
  try {
    const orderFiles = {};
    
    // Read the data_store directory
    const files = fs.readdirSync('./data_store');
    
    // Filter for order files
    const orderFileNames = files.filter(file => file.endsWith('_orders.json'));
    
    // Read each order file
    orderFileNames.forEach(fileName => {
      const userId = fileName.replace('_orders.json', '');
      const filePath = path.join('./data_store', fileName);
      
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        orderFiles[userId] = JSON.parse(fileContent);
      } catch (err) {
        console.error(`Error reading order file ${fileName}:`, err);
        orderFiles[userId] = [];
      }
    });
    
    res.json(orderFiles);
  } catch (err) {
    console.error('Error getting orders:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Route to get all customers for admin
app.get('/api/admin/customers', requireLogin, requireAdmin, (req, res) => {
  try {
    const customers = {};
    
    // Read the data_client directory
    const files = fs.readdirSync('./data_client');
    
    // Filter for profile files
    const profileFileNames = files.filter(file => file.endsWith('_profile.json'));
    
    // Read each profile file
    profileFileNames.forEach(fileName => {
      const userId = fileName.replace('_profile.json', '');
      const filePath = path.join('./data_client', fileName);
      
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        customers[userId] = JSON.parse(fileContent);
      } catch (err) {
        console.error(`Error reading profile file ${fileName}:`, err);
        customers[userId] = {};
      }
    });
    
    res.json(customers);
  } catch (err) {
    console.error('Error getting customers:', err);
    res.status(500).json({ error: 'Failed to get customers' });
  }
});

// Route to update an order
// Route to update an order
app.post('/api/update-order', requireLogin, requireAdmin, (req, res) => {
  try {
    const { userId, orderId, items, status } = req.body;
    
    // Validate inputs
    if (!userId || !orderId || !items || !status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // Read the user's order file
    const userOrdersPath = `./data_store/${userId}_orders.json`;
    
    if (!fs.existsSync(userOrdersPath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'User orders not found' 
      });
    }
    
    // Parse the file content
    const fileContent = fs.readFileSync(userOrdersPath, 'utf8');
    const orders = JSON.parse(fileContent);
    
    // Find the specific order
    const orderIndex = orders.findIndex(order => {
      // Use either the ID or the date string to identify the order
      return (order.id && order.id === orderId) || order.date === orderId;
    });
    
    if (orderIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    // Update the order
    const order = orders[orderIndex];
    
    // Update the status
    order.status = status;
    
    // Create copies of items for tracking
    if (!order.shippedItems) {
      order.shippedItems = [];
    }
    
    // Update shipped quantities for each item
    items.forEach(updatedItem => {
      const orderItem = order.items.find(item => item.Nom === updatedItem.name);
      
      if (orderItem) {
        // Initialize shipped property if it doesn't exist
        if (typeof orderItem.shipped === 'undefined') {
          orderItem.shipped = 0;
        }
        
        // Calculate total shipped (including previous shipments)
        const previouslyShipped = orderItem.shipped || 0;
        const newShippedQty = parseInt(updatedItem.shippedQty) || 0;
        const totalShipped = previouslyShipped + newShippedQty;
        
        // Update the shipped quantity
        orderItem.shipped = totalShipped;
        
        // If this is a partial shipment, track what remains to be shipped
        if (totalShipped < orderItem.quantity) {
          orderItem.remainingQty = orderItem.quantity - totalShipped;
        } else {
          // If fully shipped, remove the remaining quantity field
          delete orderItem.remainingQty;
        }
        
        // If we're shipping items now, add to shippedItems array for tracking
        if (newShippedQty > 0) {
          // Check if this item is already in shippedItems
          const existingShippedItem = order.shippedItems.find(item => item.Nom === orderItem.Nom);
          
          if (existingShippedItem) {
            // Update existing record
            existingShippedItem.quantity += newShippedQty;
          } else {
            // Add new record for this item
            order.shippedItems.push({
              ...orderItem,
              quantity: newShippedQty
            });
          }
        }
      }
    });
    
    // Check if the order is truly complete or partial
    const hasRemainingItems = order.items.some(item => 
      (item.shipped || 0) < item.quantity
    );
    
    // Update the status based on the item quantities
    order.status = hasRemainingItems ? 'partially_shipped' : 'completed';
    
    // Save the updated orders back to the file
    fs.writeFileSync(userOrdersPath, JSON.stringify(orders, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Order updated successfully',
      status: order.status
    });
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update order: ' + err.message 
    });
  }
});

// Route pour la page des commandes
app.get('/orders', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'orders.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log(`Accessible sur le réseau à l'adresse http://192.168.0.187:${PORT}`);
});