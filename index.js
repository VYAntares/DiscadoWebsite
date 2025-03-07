const express = require('express');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Import services
const userService = require('./userService');
const orderService = require('./orderService');
const productService = require('./productService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
app.use(express.static('public'));
app.use('/admin', express.static('admin'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'votre_secret_unique_ici', 
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// List of allowed users (to be migrated to database)
// This is temporary until user management is fully migrated to database
const allowedUsers = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'admin2', password: 'admin124', role: 'admin' },
  { username: 'client', password: 'client123', role: 'client' },
  { username: 'client2', password: 'client123', role: 'client' },
  { username: 'luca', password: 'lumattei', role: 'client' },
  { username: 'mengp', password: 'mengp', role: 'client' },
  { username: 'samy', password: 'samy', role: 'client' },
  { username: 'cadhor', password: 'cadhor', role: 'client' },
  { username: 'luce', password: 'luce', role: 'client' },
  { username: 'ibozurich', password: 'ibozurich', role: 'client' },
  { username: 'nazir', password: 'nazir', role: 'client' },
  { username: 'kallaya', password: 'kallaya', role: 'client' }
];

// Migration: Add default users to database
(async function migrateUsers() {
  try {
    // Check if users exist in database
    const db = require('./db').db;
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

// Function to generate PDF invoices with multi-page support
function generateInvoicePDF(doc, orderItems, userProfile, orderDate, orderId, remainingItems = []) {
  // This function remains unchanged from your original code
  // Simply import your existing PDF generation code here
  
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
    doc.image(path.join(__dirname, 'public', 'images', 'logo_discado_noir.png'), 50, 45, { width: 100 });

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

  // Add order items
  let totalHT = 0;

  orderItems.forEach(item => {
    // Check if new page needed
    if (needsNewPage(yPos, 30)) {
      yPos = addNewPage();
    }

    const itemTotal = parseFloat(item.prix) * item.quantity;
    totalHT += itemTotal;

    doc.font('Helvetica').fontSize(10);
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
  });

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
    
    // Remaining items
    remainingItems.forEach(item => {
      if (needsNewPage(toDeliverYPos, 30)) {
        addPageNumber();
        doc.addPage();
        const newHeader = addTableHeader(50);
        toDeliverYPos = newHeader.yPosition;
      }
      
      const itemTotal = parseFloat(item.prix) * item.quantity;
      
      doc.font('Helvetica').fontSize(10);
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
    });
    
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

// Main routes
app.get('/', (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin');
    } else {
      if (userService.isProfileComplete(req.session.user.username)) {
        return res.redirect('/catalog');
      } else {
        return res.redirect('/profile');
      }
    }
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
        return res.redirect('/catalog');
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
          return res.redirect('/catalog');
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

// Protected routes
app.get('/admin', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'orders.html'));
});

app.get('/admin/clients', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'clients.html'));
});

app.get('/admin/order-history', requireLogin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'order-history.html'));
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

// API routes for user profile
app.get('/api/user-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profile = userService.getUserProfile(userId);
  res.json(profile || {});
});

app.post('/api/save-profile', requireLogin, (req, res) => {
  const userId = req.session.user.username;
  const profileData = req.body;
  
  try {
    userService.saveUserProfile(profileData, userId);
    
    const isComplete = userService.isProfileComplete(userId);
    
    res.json({ 
      success: true, 
      message: 'Profile saved successfully',
      isProfileComplete: isComplete 
    });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ success: false, message: 'Error saving profile' });
  }
});

// API route for getting products
app.get('/api/products', async (req, res) => {
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

// Invoice download routes
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on http://localhost:${PORT}`);
  console.log(`Available on network at 192.168.1.232:${PORT}`);
});
