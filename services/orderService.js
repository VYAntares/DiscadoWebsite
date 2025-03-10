// orderService.js - Handle order operations
const dbModule = require('./db');
const userService = require('./userService');

// Service for managing orders
const orderService = {
    // Save a new order
    saveOrder(userId, cartItems) {
        try {
            // Check if the user has a pending order
            const pendingOrder = this.getUserPendingOrder(userId);
            
            if (pendingOrder) {
                // User has a pending order, add items to it
                return this.appendToExistingOrder(pendingOrder.order_id, userId, cartItems);
            } else {
                // No pending order, create a new one
                return this.createNewOrder(userId, cartItems);
            }
        } catch (error) {
            console.error('Error saving order:', error);
            throw error;
        }
    },
    
    // Get user's pending order (if any)
    getUserPendingOrder(userId) {
        try {
            // Find the most recent pending order for this user
            const pendingOrderQuery = dbModule.db.prepare(`
                SELECT * FROM orders 
                WHERE user_id = ? AND status = 'pending' 
                ORDER BY date DESC LIMIT 1
            `);
            
            return pendingOrderQuery.get(userId);
        } catch (error) {
            console.error('Error getting pending order:', error);
            return null;
        }
    },
    
    // Create a new order
    createNewOrder(userId, cartItems) {
        return dbModule.transaction(() => {
            const orderId = `order_${Date.now()}`;
            const date = new Date().toISOString();
            
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
            
            return { success: true, orderId, message: 'New order created successfully' };
        });
    },
    
    // Add items to an existing order
    appendToExistingOrder(orderId, userId, cartItems) {
        return dbModule.transaction(() => {
            // Get existing items in the order
            const existingItems = dbModule.getOrderItems.all(orderId);
            
            // Process each new item
            cartItems.forEach(item => {
                // Check if the item already exists in the order
                const existingItem = existingItems.find(
                    existing => existing.product_name === item.Nom && 
                                existing.category === item.categorie
                );
                
                if (existingItem) {
                    // Item exists, update the quantity
                    const newQuantity = existingItem.quantity + item.quantity;
                    
                    // Update the item quantity
                    const updateItemQuery = dbModule.db.prepare(`
                        UPDATE order_items 
                        SET quantity = ? 
                        WHERE order_id = ? AND product_name = ? AND category = ?
                    `);
                    
                    updateItemQuery.run(
                        newQuantity,
                        orderId,
                        item.Nom,
                        item.categorie
                    );
                } else {
                    // New item, add it to the order
                    dbModule.addOrderItem.run(
                        orderId,
                        item.Nom,
                        parseFloat(item.prix),
                        item.quantity,
                        item.categorie,
                        'pending'
                    );
                }
            });
            
            // Update the order date to reflect the latest addition
            const updateOrderQuery = dbModule.db.prepare(`
                UPDATE orders SET date = ? WHERE order_id = ?
            `);
            
            updateOrderQuery.run(new Date().toISOString(), orderId);
            
            return { 
                success: true, 
                orderId, 
                merged: true,
                message: 'Items added to your existing pending order' 
            };
        });
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
                
                // Group items by category
                const groupedItems = {};
                formattedItems.forEach(item => {
                    const category = item.categorie || 'autres';
                    if (!groupedItems[category]) {
                        groupedItems[category] = [];
                    }
                    groupedItems[category].push(item);
                });
                
                // Get delivered items
                const deliveredItems = items
                    .filter(item => item.status === 'delivered')
                    .map(item => ({
                        Nom: item.product_name,
                        prix: item.product_price.toString(),
                        quantity: item.quantity,
                        categorie: item.category
                    }));
                
                // Group delivered items by category
                const groupedDeliveredItems = {};
                deliveredItems.forEach(item => {
                    const category = item.categorie || 'autres';
                    if (!groupedDeliveredItems[category]) {
                        groupedDeliveredItems[category] = [];
                    }
                    groupedDeliveredItems[category].push(item);
                });
                
                // Get remaining items
                const remainingItems = items
                    .filter(item => item.status === 'remaining')
                    .map(item => ({
                        Nom: item.product_name,
                        prix: item.product_price.toString(),
                        quantity: item.quantity,
                        categorie: item.category
                    }));
                
                // Group remaining items by category
                const groupedRemainingItems = {};
                remainingItems.forEach(item => {
                    const category = item.categorie || 'autres';
                    if (!groupedRemainingItems[category]) {
                        groupedRemainingItems[category] = [];
                    }
                    groupedRemainingItems[category].push(item);
                });
                
                // Build order object
                const orderObj = {
                    orderId: order.order_id,
                    userId: order.user_id,
                    status: order.status,
                    date: order.date,
                    items: formattedItems,
                    groupedItems: groupedItems,
                    lastProcessed: order.last_processed
                };
                
                // Add delivered and remaining items if they exist
                if (deliveredItems.length > 0) {
                    orderObj.deliveredItems = deliveredItems;
                    orderObj.groupedDeliveredItems = groupedDeliveredItems;
                }
                
                if (remainingItems.length > 0) {
                    orderObj.remainingItems = remainingItems;
                    orderObj.groupedRemainingItems = groupedRemainingItems;
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
            
            return enrichedOrders;
        } catch (error) {
            console.error('Error getting user orders:', error);
            return []; // Return empty array instead of legacy fallback
        }
    },
    
    // Other methods remain unchanged...
    
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
            return []; // Return empty array instead of legacy fallback
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
            return []; // Return empty array instead of legacy fallback
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
            
            // Group delivered items by category
            const groupedDeliveredItems = {};
            deliveredItems.forEach(item => {
                const category = item.categorie || 'autres';
                if (!groupedDeliveredItems[category]) {
                    groupedDeliveredItems[category] = [];
                }
                groupedDeliveredItems[category].push(item);
            });
            
            const remainingItems = items
                .filter(item => item.status === 'remaining')
                .map(item => ({
                    Nom: item.product_name,
                    prix: item.product_price.toString(),
                    quantity: item.quantity,
                    categorie: item.category
                }));
            
            // Group remaining items by category
            const groupedRemainingItems = {};
            remainingItems.forEach(item => {
                const category = item.categorie || 'autres';
                if (!groupedRemainingItems[category]) {
                    groupedRemainingItems[category] = [];
                }
                groupedRemainingItems[category].push(item);
            });
            
            // All items (for pending orders)
            const allItems = items.map(item => ({
                Nom: item.product_name,
                prix: item.product_price.toString(),
                quantity: item.quantity,
                categorie: item.category
            }));
            
            // Group all items by category
            const groupedItems = {};
            allItems.forEach(item => {
                const category = item.categorie || 'autres';
                if (!groupedItems[category]) {
                    groupedItems[category] = [];
                }
                groupedItems[category].push(item);
            });
            
            // Build order object
            const orderObj = {
                orderId: order.order_id,
                userId: order.user_id,
                status: order.status,
                date: order.date,
                lastProcessed: order.last_processed,
                items: allItems,
                groupedItems: groupedItems,
                userProfile: userService.getUserProfile(userId)
            };
            
            // Add delivered and remaining items if they exist
            if (deliveredItems.length > 0) {
                orderObj.deliveredItems = deliveredItems;
                orderObj.groupedDeliveredItems = groupedDeliveredItems;
            }
            
            if (remainingItems.length > 0) {
                orderObj.remainingItems = remainingItems;
                orderObj.groupedRemainingItems = groupedRemainingItems;
            }
            
            return orderObj;
        } catch (error) {
            console.error('Error getting order details:', error);
            throw error; // Just propagate the error instead of fallback
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
                
                // MODIFICATION: Toujours marquer comme "completed" pour le client, même si c'est partiel
                // const newStatus = remainingItems.length > 0 ? 'partial' : 'completed';
                const newStatus = 'completed';
                
                dbModule.updateOrderStatus.run(newStatus, date, orderId);
                
                return {
                    success: true,
                    status: newStatus
                };
            });
        } catch (error) {
            console.error('Error processing order:', error);
            throw error;
        }
    }
};

module.exports = orderService;