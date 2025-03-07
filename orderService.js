// orderService.js - Handle order operations
const dbModule = require('./db');
const userService = require('./userService');
const fs = require('fs');
const path = require('path');

// Service for managing orders
const orderService = {
    // Save a new order
    saveOrder(userId, cartItems) {
        try {
            const orderId = `order_${Date.now()}`;
            const date = new Date().toISOString();
            
            return dbModule.transaction(() => {
                // Create order record
                dbModule.createOrder.run(orderId, userId, 'pending', date);
                
                // Add order items
                cartItems.forEach(item => {
                    dbModule.addOrderItem.run(
                        orderId,
                        item.Nom,
                        parseFloat(item.prix),
                        item.quantity,
                        item.categorie,
                        'pending'
                    );
                });
                
                // Also save to legacy file system during transition
                this._saveLegacyOrder(userId, orderId, cartItems, date);
                
                return { success: true, orderId };
            });
        } catch (error) {
            console.error('Error saving order:', error);
            throw error;
        }
    },
    
    // Get all orders for a user
    getUserOrders(userId) {
        try {
            const orders = dbModule.getUserOrders.all(userId);
            const enrichedOrders = [];
            
            for (const order of orders) {
                // Get order items
                const items = dbModule.getOrderItems.all(order.order_id);
                
                // Format items to match expected structure
                const formattedItems = items.map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
                
                // Get delivered items
                const deliveredItems = items
                    .filter(item => item.status === 'delivered')
                    .map(item => ({
                        Nom: item.product_name,
                        prix: item.product_price.toString(),
                        quantity: item.quantity,
                        categorie: item.category
                    }));
                
                // Get remaining items
                const remainingItems = items
                    .filter(item => item.status === 'remaining')
                    .map(item => ({
                        Nom: item.product_name,
                        prix: item.product_price.toString(),
                        quantity: item.quantity,
                        categorie: item.category
                    }));
                
                // Build order object
                const orderObj = {
                    orderId: order.order_id,
                    userId: order.user_id,
                    status: order.status,
                    date: order.date,
                    items: formattedItems,
                    lastProcessed: order.last_processed
                };
                
                // Add delivered and remaining items if they exist
                if (deliveredItems.length > 0) {
                    orderObj.deliveredItems = deliveredItems;
                }
                
                if (remainingItems.length > 0) {
                    orderObj.remainingItems = remainingItems;
                }
                
                // Get user profile
                orderObj.userProfile = userService.getUserProfile(userId);
                
                enrichedOrders.push(orderObj);
            }
            
            // Check for pending deliveries
            const pendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
            
            if (pendingDeliveries.length > 0) {
                // Format pending deliveries
                const pendingItems = pendingDeliveries.map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
                
                // Group by category
                const groupedItems = {};
                pendingItems.forEach(item => {
                    const category = item.categorie || 'autres';
                    if (!groupedItems[category]) {
                        groupedItems[category] = [];
                    }
                    groupedItems[category].push(item);
                });
                
                // Add pending delivery "order"
                enrichedOrders.unshift({
                    orderId: 'pending-delivery',
                    userId: userId,
                    status: 'pending-delivery',
                    date: new Date().toISOString(),
                    items: pendingItems,
                    isToDeliverItems: true,
                    groupedItems: groupedItems
                });
            }
            
            // If no orders found in database, try legacy system
            if (enrichedOrders.length === 0) {
                const legacyOrders = this._getLegacyUserOrders(userId);
                if (legacyOrders.length > 0) {
                    // Migrate orders to database
                    this._migrateLegacyOrders(legacyOrders, userId);
                    return legacyOrders;
                }
            }
            
            return enrichedOrders;
        } catch (error) {
            console.error('Error getting user orders:', error);
            
            // Fallback to legacy system
            return this._getLegacyUserOrders(userId);
        }
    },
    
    // Get pending orders (for admin)
    getPendingOrders() {
        try {
            const pendingOrders = dbModule.getPendingOrders.all();
            const enrichedOrders = [];
            
            for (const order of pendingOrders) {
                // Get order items
                const items = dbModule.getOrderItems.all(order.order_id);
                
                // Format items to match expected structure
                const formattedItems = items.map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
                
                // Build order object
                const orderObj = {
                    orderId: order.order_id,
                    userId: order.user_id,
                    status: order.status,
                    date: order.date,
                    items: formattedItems
                };
                
                // Get user profile
                orderObj.userProfile = userService.getUserProfile(order.user_id);
                
                enrichedOrders.push(orderObj);
            }
            
            return enrichedOrders;
        } catch (error) {
            console.error('Error getting pending orders:', error);
            
            // Fallback to legacy system
            return this._getLegacyPendingOrders();
        }
    },
    
    // Get treated orders (for admin)
    getTreatedOrders() {
        try {
            const treatedOrders = dbModule.getTreatedOrders.all();
            const enrichedOrders = [];
            
            for (const order of treatedOrders) {
                // Get delivered items
                const deliveredItems = dbModule.getOrderItemsByStatus.all(order.order_id, 'delivered');
                
                // Format items to match expected structure
                const formattedDeliveredItems = deliveredItems.map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
                
                // Get remaining items
                const remainingItems = dbModule.getOrderItemsByStatus.all(order.order_id, 'remaining');
                
                // Format remaining items
                const formattedRemainingItems = remainingItems.map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
                
                // Build order object
                const orderObj = {
                    orderId: order.order_id,
                    userId: order.user_id,
                    status: order.status,
                    date: order.date,
                    lastProcessed: order.last_processed,
                    deliveredItems: formattedDeliveredItems
                };
                
                // Add remaining items if they exist
                if (formattedRemainingItems.length > 0) {
                    orderObj.remainingItems = formattedRemainingItems;
                }
                
                // Get user profile
                orderObj.userProfile = userService.getUserProfile(order.user_id);
                
                enrichedOrders.push(orderObj);
            }
            
            return enrichedOrders;
        } catch (error) {
            console.error('Error getting treated orders:', error);
            
            // Fallback to legacy system
            return this._getLegacyTreatedOrders();
        }
    },
    
    // Get order details
    getOrderDetails(orderId, userId) {
        try {
            const order = dbModule.getOrderById.get(orderId);
            
            if (!order) {
                throw new Error('Order not found');
            }
            
            // Get all items
            const items = dbModule.getOrderItems.all(orderId);
            
            // Format items based on status
            const deliveredItems = items
                .filter(item => item.status === 'delivered')
                .map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
            
            const remainingItems = items
                .filter(item => item.status === 'remaining')
                .map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
            
            // All items (for pending orders)
            const allItems = items.map(item => ({
                Nom: item.product_name,
                prix: item.product_price.toString(),
                quantity: item.quantity,
                categorie: item.category
            }));
            
            // Build order object
            const orderObj = {
                orderId: order.order_id,
                userId: order.user_id,
                status: order.status,
                date: order.date,
                lastProcessed: order.last_processed,
                items: allItems,
                userProfile: userService.getUserProfile(userId)
            };
            
            // Add delivered and remaining items if they exist
            if (deliveredItems.length > 0) {
                orderObj.deliveredItems = deliveredItems;
            }
            
            if (remainingItems.length > 0) {
                orderObj.remainingItems = remainingItems;
            }
            
            return orderObj;
        } catch (error) {
            console.error('Error getting order details:', error);
            
            // Fallback to legacy system
            return this._getLegacyOrderDetails(orderId, userId);
        }
    },
    
    // Process an order (mark items as delivered/remaining)
    processOrder(orderId, userId, deliveredItems) {
        try {
            const date = new Date().toISOString();
            
            return dbModule.transaction(() => {
                // Get the order first
                const order = dbModule.getOrderById.get(orderId);
                
                if (!order) {
                    throw new Error('Order not found');
                }
                
                // Get all order items
                const allItems = dbModule.getOrderItems.all(orderId);
                
                // Track remaining items
                const remainingItems = [];
                
                // Process each original item
                allItems.forEach(item => {
                    // Find if the item was delivered
                    const deliveredItem = deliveredItems.find(
                        d => d.Nom === item.product_name
                    );
                    
                    if (deliveredItem && deliveredItem.quantity > 0) {
                        // Update item status to delivered
                        dbModule.updateOrderItemStatus.run('delivered', orderId, item.product_name);
                        
                        // Check if partially delivered
                        if (deliveredItem.quantity < item.quantity) {
                            const remainingQuantity = item.quantity - deliveredItem.quantity;
                            
                            // Add to remaining items
                            remainingItems.push({
                                Nom: item.product_name,
                                prix: item.product_price.toString(),
                                quantity: remainingQuantity,
                                categorie: item.category
                            });
                            
                            // Update item status to remaining
                            dbModule.updateOrderItemStatus.run('remaining', orderId, item.product_name);
                            
                            // Add to pending deliveries
                            dbModule.addPendingDelivery.run(
                                userId,
                                item.product_name,
                                item.product_price,
                                remainingQuantity,
                                item.category
                            );
                        }
                    } else {
                        // Not delivered at all, mark as remaining
                        dbModule.updateOrderItemStatus.run('remaining', orderId, item.product_name);
                        
                        // Add to remaining items
                        remainingItems.push({
                            Nom: item.product_name,
                            prix: item.product_price.toString(),
                            quantity: item.quantity,
                            categorie: item.category
                        });
                        
                        // Add to pending deliveries
                        dbModule.addPendingDelivery.run(
                            userId,
                            item.product_name,
                            item.product_price,
                            item.quantity,
                            item.category
                        );
                    }
                });
                
                // Update order status
                const newStatus = remainingItems.length > 0 ? 'partial' : 'completed';
                dbModule.updateOrderStatus.run(newStatus, date, orderId);
                
                // Also update legacy file system during transition
                this._updateLegacyOrder(orderId, userId, deliveredItems, remainingItems, newStatus, date);
                
                return {
                    success: true,
                    status: newStatus
                };
            });
        } catch (error) {
            console.error('Error processing order:', error);
            throw error;
        }
    },
    
    // Helper: Save to legacy file system for backward compatibility
    _saveLegacyOrder(userId, orderId, items, date) {
        try {
            // Ensure user orders directory exists
            const userOrdersDir = path.join(__dirname, 'data_store', `${userId}_orders`);
            const pendingDir = path.join(userOrdersDir, 'pending');
            
            if (!fs.existsSync(pendingDir)) {
                fs.mkdirSync(pendingDir, { recursive: true });
            }
            
            // Create order object
            const orderData = {
                orderId,
                userId,
                status: 'pending',
                date,
                items
            };
            
            // Save to pending directory
            fs.writeFileSync(
                path.join(pendingDir, `${orderId}.json`),
                JSON.stringify(orderData, null, 2)
            );
            
            // Legacy compatibility - add to old format file if it exists
            const legacyOrdersPath = path.join(__dirname, 'data_store', `${userId}_orders.json`);
            if (fs.existsSync(legacyOrdersPath)) {
                let legacyOrders = [];
                
                try {
                    const fileContent = fs.readFileSync(legacyOrdersPath, 'utf8');
                    legacyOrders = JSON.parse(fileContent);
                } catch (e) {
                    console.error('Error reading legacy orders file:', e);
                }
                
                legacyOrders.push(orderData);
                
                fs.writeFileSync(
                    legacyOrdersPath,
                    JSON.stringify(legacyOrders, null, 2)
                );
            }
        } catch (error) {
            console.error('Error saving legacy order:', error);
        }
    },
    
    // Helper: Update legacy order files
    _updateLegacyOrder(orderId, userId, deliveredItems, remainingItems, status, date) {
        try {
            // Ensure user orders directories exist
            const userOrdersDir = path.join(__dirname, 'data_store', `${userId}_orders`);
            const treatedDir = path.join(userOrdersDir, 'treated');
            const deliveredDir = path.join(userOrdersDir, 'delivered');
            const toDeliverDir = path.join(userOrdersDir, 'to-deliver');
            
            [treatedDir, deliveredDir, toDeliverDir].forEach(dir => {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
            });
            
            // Get original order from pending
            const pendingDir = path.join(userOrdersDir, 'pending');
            const pendingOrderPath = path.join(pendingDir, `${orderId}.json`);
            
            let originalOrder = null;
            
            if (fs.existsSync(pendingOrderPath)) {
                originalOrder = JSON.parse(fs.readFileSync(pendingOrderPath, 'utf8'));
            } else {
                // Try to find in legacy format
                const legacyOrdersPath = path.join(__dirname, 'data_store', `${userId}_orders.json`);
                if (fs.existsSync(legacyOrdersPath)) {
                    const legacyOrders = JSON.parse(fs.readFileSync(legacyOrdersPath, 'utf8'));
                    originalOrder = legacyOrders.find(o => o.orderId === orderId);
                }
            }
            
            if (!originalOrder) {
                console.error('Original order not found for legacy update');
                return;
            }
            
            // Create treated order
            const treatedOrder = {
                ...originalOrder,
                status,
                lastProcessed: date,
                deliveredItems,
                remainingItems
            };
            
            // Save to treated directory
            fs.writeFileSync(
                path.join(treatedDir, `${orderId}.json`),
                JSON.stringify(treatedOrder, null, 2)
            );
            
            // Create delivery invoice
            const deliveryInvoice = {
                orderId,
                userId,
                invoiceDate: date,
                items: deliveredItems,
                originalOrderDate: originalOrder.date
            };
            
            // Save to delivered directory
            fs.writeFileSync(
                path.join(deliveredDir, `${orderId}_invoice.json`),
                JSON.stringify(deliveryInvoice, null, 2)
            );
            
            // Handle remaining items
            if (remainingItems.length > 0) {
                const toDeliverPath = path.join(toDeliverDir, 'to-deliver.json');
                let toDeliverItems = [];
                
                // Check if file exists
                if (fs.existsSync(toDeliverPath)) {
                    toDeliverItems = JSON.parse(fs.readFileSync(toDeliverPath, 'utf8'));
                }
                
                // Merge with new items
                remainingItems.forEach(newItem => {
                    const existingIndex = toDeliverItems.findIndex(
                        item => item.Nom === newItem.Nom && item.categorie === newItem.categorie
                    );
                    
                    if (existingIndex !== -1) {
                        if (newItem.quantity > toDeliverItems[existingIndex].quantity) {
                            toDeliverItems[existingIndex].quantity = newItem.quantity;
                        }
                    } else {
                        toDeliverItems.push(newItem);
                    }
                });
                
                // Save updated to-deliver items
                fs.writeFileSync(
                    toDeliverPath,
                    JSON.stringify(toDeliverItems, null, 2)
                );
            }
            
            // Remove from pending
            if (fs.existsSync(pendingOrderPath)) {
                fs.unlinkSync(pendingOrderPath);
            }
            
            // Update legacy format if it exists
            const legacyOrdersPath = path.join(__dirname, 'data_store', `${userId}_orders.json`);
            if (fs.existsSync(legacyOrdersPath)) {
                let legacyOrders = JSON.parse(fs.readFileSync(legacyOrdersPath, 'utf8'));
                
                // Find and update the order
                const orderIndex = legacyOrders.findIndex(o => o.orderId === orderId);
                if (orderIndex !== -1) {
                    legacyOrders[orderIndex] = treatedOrder;
                    
                    fs.writeFileSync(
                        legacyOrdersPath,
                        JSON.stringify(legacyOrders, null, 2)
                    );
                }
            }
        } catch (error) {
            console.error('Error updating legacy order:', error);
        }
    },
    
    // Helper: Get user orders from legacy system
    _getLegacyUserOrders(userId) {
        try {
            // Check for legacy order file
            const legacyOrdersPath = path.join(__dirname, 'data_store', `${userId}_orders.json`);
            
            if (fs.existsSync(legacyOrdersPath)) {
                const orders = JSON.parse(fs.readFileSync(legacyOrdersPath, 'utf8'));
                return orders;
            }
            
            // Check for directory structure
            const userOrdersDir = path.join(__dirname, 'data_store', `${userId}_orders`);
            
            if (!fs.existsSync(userOrdersDir)) {
                return [];
            }
            
            // Collect orders from all directories
            const pendingDir = path.join(userOrdersDir, 'pending');
            const treatedDir = path.join(userOrdersDir, 'treated');
            const allOrders = [];
            
            // Get pending orders
            if (fs.existsSync(pendingDir)) {
                const pendingFiles = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
                
                pendingFiles.forEach(file => {
                    const orderPath = path.join(pendingDir, file);
                    const orderData = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
                    allOrders.push(orderData);
                });
            }
            
            // Get treated orders
            if (fs.existsSync(treatedDir)) {
                const treatedFiles = fs.readdirSync(treatedDir).filter(f => f.endsWith('.json'));
                
                treatedFiles.forEach(file => {
                    const orderPath = path.join(treatedDir, file);
                    const orderData = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
                    allOrders.push(orderData);
                });
            }
            
            // Check for to-deliver items
            const toDeliverDir = path.join(userOrdersDir, 'to-deliver');
            const toDeliverPath = path.join(toDeliverDir, 'to-deliver.json');
            
            if (fs.existsSync(toDeliverPath)) {
                const toDeliverItems = JSON.parse(fs.readFileSync(toDeliverPath, 'utf8'));
                
                if (toDeliverItems.length > 0) {
                    // Create grouped items by category
                    const groupedItems = {};
                    
                    toDeliverItems.forEach(item => {
                        const category = item.categorie || 'autres';
                        if (!groupedItems[category]) {
                            groupedItems[category] = [];
                        }
                        groupedItems[category].push(item);
                    });
                    
                    // Add special pending delivery order
                    allOrders.unshift({
                        orderId: 'pending-delivery',
                        userId,
                        status: 'pending-delivery',
                        date: new Date().toISOString(),
                        items: toDeliverItems,
                        isToDeliverItems: true,
                        groupedItems
                    });
                }
            }
            
            return allOrders;
        } catch (error) {
            console.error('Error getting legacy user orders:', error);
            return [];
        }
    },
    
    // Helper: Get pending orders from legacy system
    _getLegacyPendingOrders() {
        try {
            const dataStoreDir = path.join(__dirname, 'data_store');
            const userDirs = fs.readdirSync(dataStoreDir)
                .filter(item => 
                    fs.statSync(path.join(dataStoreDir, item)).isDirectory() && 
                    item.endsWith('_orders')
                );
            
            const pendingOrders = [];
            
            userDirs.forEach(userDir => {
                const userId = userDir.replace('_orders', '');
                const pendingDir = path.join(dataStoreDir, userDir, 'pending');
                
                if (fs.existsSync(pendingDir)) {
                    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
                    
                    files.forEach(file => {
                        const orderPath = path.join(pendingDir, file);
                        const orderData = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
                        
                        // Add user ID
                        orderData.userId = userId;
                        
                        // Add user profile
                        orderData.userProfile = userService.getUserProfile(userId);
                        
                        pendingOrders.push(orderData);
                    });
                }
            });
            
            // Sort by date (oldest first)
            pendingOrders.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            return pendingOrders;
        } catch (error) {
            console.error('Error getting legacy pending orders:', error);
            return [];
        }
    },
    
    // Helper: Get treated orders from legacy system
    _getLegacyTreatedOrders() {
        try {
            const dataStoreDir = path.join(__dirname, 'data_store');
            const userDirs = fs.readdirSync(dataStoreDir)
                .filter(item => 
                    fs.statSync(path.join(dataStoreDir, item)).isDirectory() && 
                    item.endsWith('_orders')
                );
            
            const treatedOrders = [];
            
            userDirs.forEach(userDir => {
                const userId = userDir.replace('_orders', '');
                const treatedDir = path.join(dataStoreDir, userDir, 'treated');
                
                if (fs.existsSync(treatedDir)) {
                    const files = fs.readdirSync(treatedDir).filter(f => f.endsWith('.json'));
                    
                    files.forEach(file => {
                        const orderPath = path.join(treatedDir, file);
                        const orderData = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
                        
                        // Add user ID
                        orderData.userId = userId;
                        
                        // Add user profile
                        orderData.userProfile = userService.getUserProfile(userId);
                        
                        treatedOrders.push(orderData);
                    });
                }
            });
            
            // Sort by last processed date (newest first)
            treatedOrders.sort((a, b) => new Date(b.lastProcessed || b.date) - new Date(a.lastProcessed || a.date));
            
            return treatedOrders;
        } catch (error) {
            console.error('Error getting legacy treated orders:', error);
            return [];
        }
    },
    
    // Helper: Get order details from legacy system
    _getLegacyOrderDetails(orderId, userId) {
        try {
            // First try the treated orders directory
            const userOrdersDir = path.join(__dirname, 'data_store', `${userId}_orders`);
            const treatedDir = path.join(userOrdersDir, 'treated');
            const treatedOrderPath = path.join(treatedDir, `${orderId}.json`);
            
            if (fs.existsSync(treatedOrderPath)) {
                const orderData = JSON.parse(fs.readFileSync(treatedOrderPath, 'utf8'));
                
                // Add user profile
                orderData.userProfile = userService.getUserProfile(userId);
                
                return orderData;
            }
            
            // Then try the pending orders directory
            const pendingDir = path.join(userOrdersDir, 'pending');
            const pendingOrderPath = path.join(pendingDir, `${orderId}.json`);
            
            if (fs.existsSync(pendingOrderPath)) {
                const orderData = JSON.parse(fs.readFileSync(pendingOrderPath, 'utf8'));
                
                // Add user profile
                orderData.userProfile = userService.getUserProfile(userId);
                
                return orderData;
            }
            
            // Finally try the legacy format
            const legacyOrdersPath = path.join(__dirname, 'data_store', `${userId}_orders.json`);
            
            if (fs.existsSync(legacyOrdersPath)) {
                const orders = JSON.parse(fs.readFileSync(legacyOrdersPath, 'utf8'));
                const order = orders.find(o => o.orderId === orderId);
                
                if (order) {
                    // Add user profile
                    order.userProfile = userService.getUserProfile(userId);
                    
                    return order;
                }
            }
            
            throw new Error('Order not found');
        } catch (error) {
            console.error('Error getting legacy order details:', error);
            throw error;
        }
    },
    
    // Helper: Migrate legacy orders to database
    _migrateLegacyOrders(orders, userId) {
        try {
            orders.forEach(order => {
                // Skip special pending delivery "order"
                if (order.orderId === 'pending-delivery' || order.isToDeliverItems) {
                    return;
                }
                
                // Check if order already exists in database
                const existingOrder = dbModule.getOrderById.get(order.orderId);
                
                if (existingOrder) {
                    return; // Skip if already exists
                }
                
                // Add order to database
                dbModule.transaction(() => {
                    // Create order record
                    dbModule.createOrder.run(
                        order.orderId,
                        userId,
                        order.status || 'pending',
                        order.date
                    );
                    
                    // Set last processed date if it exists
                    if (order.lastProcessed) {
                        dbModule.updateOrderStatus.run(
                            order.status,
                            order.lastProcessed,
                            order.orderId
                        );
                    }
                    
                    // Add all items
                    if (order.items) {
                        order.items.forEach(item => {
                            dbModule.addOrderItem.run(
                                order.orderId,
                                item.Nom,
                                parseFloat(item.prix),
                                item.quantity,
                                item.categorie,
                                'pending'
                            );
                        });
                    }
                    
                    // Add delivered items if they exist
                    if (order.deliveredItems) {
                        order.deliveredItems.forEach(item => {
                            // Update status to delivered
                            dbModule.updateOrderItemStatus.run(
                                'delivered',
                                order.orderId,
                                item.Nom
                            );
                        });
                    }
                    
                    // Add remaining items if they exist
                    if (order.remainingItems) {
                        order.remainingItems.forEach(item => {
                            // Update status to remaining
                            dbModule.updateOrderItemStatus.run(
                                'remaining',
                                order.orderId,
                                item.Nom
                            );
                            
                            // Add to pending deliveries
                            dbModule.addPendingDelivery.run(
                                userId,
                                item.Nom,
                                parseFloat(item.prix),
                                item.quantity,
                                item.categorie
                            );
                        });
                    }
                });
            });
            
            console.log(`Migrated ${orders.length} legacy orders for user ${userId}`);
        } catch (error) {
            console.error('Error migrating legacy orders:', error);
        }
    }
};

module.exports = orderService;