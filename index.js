const express = require('express');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Import services
const userService = require('./services/userService');
const orderService = require('./services/orderService');
const productService = require('./services/productService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configure express-session middleware
app.use(session({
  secret: 'discado-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware for checking login
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}

// Middleware for admin access
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).send('Access denied');
}

// Middleware for complete profile
function requireCompleteProfile(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  if (req.session.user.role === 'admin') {
    return next(); // Admins don't need complete profiles
  }
  
  if (!userService.isProfileComplete(req.session.user.username)) {
    return res.redirect('/profile');
  }
  
  next();
}

// Only serve the login page and index.html from public root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/pages/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'login.html'));
});

// Serve non-sensitive static assets without authentication
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/fonts', express.static(path.join(__dirname, 'public/fonts')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/components', express.static(path.join(__dirname, 'public/components')));

// Configure ES6 modules for admin JS files
app.use('/admin/js', (req, res, next) => {
  // Serve JS files with appropriate Content-Type header for ES modules
  if (req.path.endsWith('.js')) {
    res.set('Content-Type', 'application/javascript; charset=UTF-8');
  }
  next();
});

// Admin static files (protected by requireAdmin middleware later for admin routes)
app.use('/admin/css', express.static(path.join(__dirname, 'admin/css')));
app.use('/admin/js', express.static(path.join(__dirname, 'admin/js')));

// IMPORTANT: Protect all sensitive pages with authentication
// Block direct access to pages directory (except login)
app.use('/pages/', (req, res, next) => {
  const requestPath = req.path;
  
  // Allow access to login page
  if (requestPath === '/login.html') {
    return next();
  }
  
  // Require authentication for all other pages
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  // Continue for authenticated users
  next();
});

// This is temporary until user management is fully migrated to database
const allowedUsers = [
  { username: 'admin', password: 'admin', role: 'admin' },
  { username: 'client', password: 'client', role: 'client' }
];

// Migration: Add default users to database
(async function migrateUsers() {
  try {
    // Check if users exist in database
    const db = require('./services/db').db;
    const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get();
    
    if (count === 0) {
      console.log('Migrating default users to database...');
      
      // Add users in a transaction
      db.transaction((users) => {
        for (const user of users) {
          try {
            userService.createUser(user.username, user.password, user.role);
          } catch (error) {
            console.error(`Error adding user ${user.username}:`, error);
          }
        }
      })(allowedUsers);
      
      console.log('User migration completed');
    }
  } catch (error) {
    console.error('Error during user migration:', error);
  }
})();

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Check database for user
  const user = userService.getUser(username);
  
  if (user && user.password === password) {
    req.session.user = user;
    
    if (user.role === 'admin') {
      return res.redirect('/admin');
    } else {
      if (userService.isProfileComplete(username)) {
        return res.redirect('/pages/catalog.html');
      } else {
        return res.redirect('/profile');
      }
    }
  } else {
    // Check legacy list (temporary during migration)
    const legacyUser = allowedUsers.find(u => u.username === username && u.password === password);
    
    if (legacyUser) {
      // Create user in database for future logins
      try {
        userService.createUser(legacyUser.username, legacyUser.password, legacyUser.role);
      } catch (error) {
        console.error('Error creating user in database:', error);
      }
      
      req.session.user = legacyUser;
      
      if (legacyUser.role === 'admin') {
        return res.redirect('/admin');
      } else {
        if (userService.isProfileComplete(username)) {
          return res.redirect('/pages/catalog.html');
        } else {
          return res.redirect('/profile');
        }
      }
    }
  }
  
  res.status(401).send('Invalid credentials. <a href="/">Try again</a>');
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.send('Error during logout');
    res.redirect('/');
  });
});

// Protected routes - With proper middleware
app.get('/admin', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/orders', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'orders.html'));
});

app.get('/admin/clients', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'clients.html'));
});

app.get('/admin/order-history', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'pages', 'order-history.html'));
});

// Protected client routes - All with requireLogin
app.get('/pages/catalog.html', requireLogin, requireCompleteProfile, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'catalog.html'));
});

app.get('/profile', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'profile.html'));
});

app.get('/pages/profile.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'profile.html'));
});

app.get('/orders', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'orders.html'));
});

app.get('/pages/orders.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'orders.html'));
});

// API routes for checking authentication
app.get('/api/check-auth', (req, res) => {
  if (req.session.user) {
    res.json({ 
      authenticated: true, 
      username: req.session.user.username,
      role: req.session.user.role
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// API routes for user profile
app.get('/api/user-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profile = userService.getUserProfile(userId);
  res.json(profile || {});
});

app.post('/api/save-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profileData = req.body;
  
  // Debug log to see what's being received
  console.log(`Saving profile for user ${userId}:`, JSON.stringify(profileData, null, 2));
  
  try {
    // Check if we have the minimum required data
    if (!profileData) {
      console.error('Missing profile data in request');
      return res.status(400).json({ 
        success: false, 
        message: 'No profile data provided'
      });
    }
    
    // Sauvegarder les données du profil
    const result = userService.saveUserProfile(profileData, userId);
    console.log('Profile save result:', result);
    
    // Vérifier si le profil est complet
    const isComplete = userService.isProfileComplete(userId);
    console.log('Is profile complete:', isComplete);
    
    // Récupérer le profil mis à jour pour vérification
    const updatedProfile = userService.getUserProfile(userId);
    console.log('Updated profile:', updatedProfile);
    
    // Réponse améliorée avec plus de détails
    res.json({ 
      success: true, 
      message: 'Profil sauvegardé avec succès',
      isProfileComplete: isComplete,
      profile: updatedProfile,
      shouldRedirect: isComplete,
      redirectUrl: isComplete ? '/pages/catalog.html' : null
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du profil:', error);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la sauvegarde du profil: ${error.message}`,
      error: error.message
    });
  }
});

// API route for getting products - ALSO REQUIRES LOGIN
app.get('/api/products', requireLogin, async (req, res) => {
  try {
    const products = await productService.getProducts();
    res.json(products);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: 'Error getting products' });
  }
});

// API route for saving an order
app.post('/api/save-order', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const cartItems = req.body.items;
  
  try {
    const result = orderService.saveOrder(userId, cartItems);
    res.json(result);
  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).json({ success: false, message: 'Error saving order' });
  }
});

// API route for getting user orders
app.get('/api/user-orders', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  
  try {
    const orders = orderService.getUserOrders(userId);
    res.json(orders);
  } catch (error) {
    console.error('Error getting user orders:', error);
    res.status(500).json({ error: 'Error getting user orders' });
  }
});

// Admin API routes
app.get('/api/admin/pending-orders', requireLogin, requireAdmin, (req, res) => {
  try {
    const pendingOrders = orderService.getPendingOrders();
    res.json(pendingOrders);
  } catch (error) {
    console.error('Error getting pending orders:', error);
    res.status(500).json({ error: 'Error getting pending orders' });
  }
});

app.get('/api/admin/treated-orders', requireLogin, requireAdmin, (req, res) => {
  try {
    const treatedOrders = orderService.getTreatedOrders();
    res.json(treatedOrders);
  } catch (error) {
    console.error('Error getting treated orders:', error);
    res.status(500).json({ error: 'Error getting treated orders' });
  }
});

app.get('/api/admin/client-profiles', requireLogin, requireAdmin, (req, res) => {
  try {
    const profiles = userService.getAllClientProfiles();
    res.json(profiles);
  } catch (error) {
    console.error('Error getting client profiles:', error);
    res.status(500).json({ error: 'Error getting client profiles' });
  }
});

app.get('/api/admin/client-profile/:userId', requireLogin, requireAdmin, (req, res) => {
  const userId = req.params.userId;
  
  try {
    const profile = userService.getUserProfile(userId);
    
    if (profile) {
      res.json(profile);
    } else {
      res.status(404).json({ error: 'Client profile not found' });
    }
  } catch (error) {
    console.error('Error getting client profile:', error);
    res.status(500).json({ error: 'Error getting client profile' });
  }
});

app.post('/api/admin/process-order', requireLogin, requireAdmin, (req, res) => {
  const { userId, orderId, deliveredItems } = req.body;
  
  if (!userId || !orderId || !Array.isArray(deliveredItems)) {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }
  
  try {
    const result = orderService.processOrder(orderId, userId, deliveredItems);
    res.json(result);
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ error: 'Error processing order' });
  }
});

app.get('/api/admin/order-details/:orderId/:userId', requireLogin, requireAdmin, (req, res) => {
  const { orderId, userId } = req.params;
  
  try {
    const orderDetails = orderService.getOrderDetails(orderId, userId);
    res.json(orderDetails);
  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({ error: 'Error getting order details' });
  }
});

app.get('/api/admin/client-orders/:clientId', requireLogin, requireAdmin, (req, res) => {
  const clientId = req.params.clientId;
  
  try {
    const orders = orderService.getUserOrders(clientId);
    res.json(orders);
  } catch (error) {
    console.error('Error getting client orders:', error);
    res.status(500).json({ error: 'Error getting client orders' });
  }
});

app.get('/api/download-invoice/:orderId', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const orderId = req.params.orderId;
  
  try {
    // Get order details
    const orderDetails = orderService.getOrderDetails(orderId, userId);
    
    // Get user profile
    const userProfile = userService.getUserProfile(userId);
    
    if (!orderDetails || !userProfile) {
      return res.status(404).json({ error: 'Order or user profile not found' });
    }
    
    // Check if order has delivered items
    if (orderDetails.status !== 'completed' && orderDetails.status !== 'partial' && 
        (!orderDetails.deliveredItems || orderDetails.deliveredItems.length === 0)) {
      return res.status(403).json({ 
        error: 'This order has not been delivered yet. No invoice available.' 
      });
    }
    
    // Get delivered items
    const orderItems = orderDetails.deliveredItems || orderDetails.items;
    const orderDate = new Date(orderDetails.lastProcessed || orderDetails.date);
    const remainingItems = orderDetails.remainingItems || [];
    
    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${userId}_${orderId}.pdf`);
    
    // Pipe to response
    doc.pipe(res);
    
    // Generate invoice
    generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems);
    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Error generating invoice' });
  }
});

app.get('/api/admin/download-invoice/:orderId/:userId', requireLogin, requireAdmin, (req, res) => {
  const { orderId, userId } = req.params;
  
  try {
    // Get order details
    const orderDetails = orderService.getOrderDetails(orderId, userId);
    
    // Get user profile
    const userProfile = userService.getUserProfile(userId);
    
    if (!orderDetails || !userProfile) {
      return res.status(404).json({ error: 'Order or user profile not found' });
    }
    
    // Check if order has delivered items
    if (orderDetails.status !== 'completed' && orderDetails.status !== 'partial' && 
        (!orderDetails.deliveredItems || orderDetails.deliveredItems.length === 0)) {
      return res.status(403).json({ 
        error: 'This order has not been delivered yet. No invoice available.' 
      });
    }
    
    // Get delivered items
    const orderItems = orderDetails.deliveredItems || orderDetails.items;
    const orderDate = new Date(orderDetails.lastProcessed || orderDetails.date);
    const remainingItems = orderDetails.remainingItems || [];
    
    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${userId}_${orderId}.pdf`);
    
    // Pipe to response
    doc.pipe(res);
    
    // Generate invoice
    generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems);
    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Error generating invoice' });
  }
});

// Route for creating a new client account (admin only)
app.post('/api/admin/create-client', requireLogin, requireAdmin, (req, res) => {
  const { username, password, profileData } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Nom d\'utilisateur et mot de passe requis' 
    });
  }
  
  try {
    // Check if user already exists
    const existingUser = userService.getUser(username);
    
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Ce nom d\'utilisateur existe déjà' 
      });
    }
    
    // Create user
    userService.createUser(username, password, 'client');
    
    // Create profile if data is provided
    if (profileData) {
      userService.saveUserProfile(profileData, username);
    }
    
    res.json({ 
      success: true, 
      message: 'Client créé avec succès',
      username
    });
  } catch (error) {
    console.error('Erreur lors de la création du client:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création du client'
    });
  }
});

// Catch-all route - Redirect to login for unauthorized users
app.get('*', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  // For authenticated users, try to serve the file or send 404
  res.status(404).send('Page not found. <a href="/">Return to homepage</a>');
});

// Error handling middleware
app.use((req, res, next) => {
  res.status(404).send('Page not found. <a href="/">Return to homepage</a>');
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Server error occurred. Please try again later.');
});

function generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems = []) {
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
    doc.image(path.join(__dirname, 'public', 'images', 'logo', 'logo_discado_noir.png'), 50, 45, { width: 100 });

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
  
  // Items to deliver section (if applicable)
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on http://localhost:${PORT}`);
  console.log(`Available on network at http://172.20.10.3:${PORT}`);
});