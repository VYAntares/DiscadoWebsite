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
// Modification de la fonction createNewOrder dans orderService.js
    createNewOrder(userId, cartItems) {
        return dbModule.transaction(() => {
            // Dans createNewOrder et createOrderFromPendingItems:
            const now = new Date();
            const year = now.getFullYear().toString().slice(-2); // Derniers 2 chiffres de l'année
            const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Mois (01-12)
            const day = now.getDate().toString().padStart(2, '0'); // Jour (01-31)
            const hour = now.getHours().toString().padStart(2, '0'); // Heure (00-23)
            const minute = now.getMinutes().toString().padStart(2, '0'); // Minutes (00-59)
            const second = now.getSeconds().toString().padStart(2, '0'); // Secondes (00-59)
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // Nombre aléatoire de 3 chiffres

            // Format: YYMM-DDHH-MMSSR (Minutes, Secondes, Random)
            const orderId = `${year}${month}-${day}${hour}-${minute}${second}${random}`;
            const date = new Date().toISOString();
            
            // Récupérer les articles en attente de livraison pour ce client
            const pendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
            
            // Créer l'enregistrement de commande
            dbModule.createOrder.run(orderId, userId, 'pending', date);
            
            // Traiter chaque article du panier
            cartItems.forEach(item => {
                // Vérifier si l'article existe dans la liste "à livrer"
                const pendingItem = pendingDeliveries.find(
                    pending => pending.product_name === item.Nom && 
                            pending.category === item.categorie
                );
                
                if (pendingItem) {
                    // L'article existe dans "à livrer", gérer la déduction
                    if (pendingItem.quantity <= item.quantity) {
                        // La quantité commandée est supérieure ou égale à celle "à livrer"
                        // Supprimer complètement l'article de "à livrer"
                        dbModule.removePendingDelivery.run(pendingItem.id);
                        
                        // Ajouter à la commande normalement
                        dbModule.addOrderItem.run(
                            orderId,
                            item.Nom,
                            parseFloat(item.prix),
                            item.quantity,
                            item.categorie,
                            'pending'
                        );
                    } else {
                        // La quantité commandée est inférieure à celle "à livrer"
                        // Réduire la quantité dans "à livrer"
                        const newPendingQuantity = pendingItem.quantity - item.quantity;
                        dbModule.updatePendingDeliveryQuantity.run(
                            newPendingQuantity,
                            pendingItem.id
                        );
                        
                        // Ajouter à la commande normalement
                        dbModule.addOrderItem.run(
                            orderId,
                            item.Nom,
                            parseFloat(item.prix),
                            item.quantity,
                            item.categorie,
                            'pending'
                        );
                    }
                } else {
                    // L'article n'existe pas dans "à livrer", l'ajouter normalement
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
            
            return { success: true, orderId, message: 'New order created successfully' };
        });
    },
    
    // Add items to an existing order
// Modification de la fonction appendToExistingOrder pour gérer les articles à livrer
    appendToExistingOrder(orderId, userId, cartItems) {
        return dbModule.transaction(() => {
            // Récupérer les articles en attente de livraison pour ce client
            const pendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
            
            // Get existing items in the order
            const existingItems = dbModule.getOrderItems.all(orderId);
            
            // Process each new item
            cartItems.forEach(item => {
                // Vérifier si l'article existe dans la liste "à livrer"
                const pendingItem = pendingDeliveries.find(
                    pending => pending.product_name === item.Nom && 
                            pending.category === item.categorie
                );
                
                if (pendingItem) {
                    // L'article existe dans "à livrer", gérer la déduction
                    if (pendingItem.quantity <= item.quantity) {
                        // La quantité commandée est supérieure ou égale à celle "à livrer"
                        // Supprimer complètement l'article de "à livrer"
                        dbModule.removePendingDelivery.run(pendingItem.id);
                    } else {
                        // La quantité commandée est inférieure à celle "à livrer"
                        // Réduire la quantité dans "à livrer"
                        const newPendingQuantity = pendingItem.quantity - item.quantity;
                        dbModule.updatePendingDeliveryQuantity.run(
                            newPendingQuantity,
                            pendingItem.id
                        );
                    }
                }
                
                // Vérifier si l'article existe déjà dans la commande
                const existingItem = existingItems.find(
                    existing => existing.product_name === item.Nom && 
                                existing.category === item.categorie
                );
                
                if (existingItem) {
                    // Item exists, update the quantity
                    const newQuantity = existingItem.quantity + item.quantity;
                    
                    // Update the item quantity
                    dbModule.updateOrderItemQuantity.run(
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
            dbModule.updateOrderDate.run(new Date().toISOString(), orderId);
            
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
    
    // Mise à jour de la fonction processOrder
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
                
                // Récupérer les articles déjà en attente de livraison pour cet utilisateur
                const existingPendingDeliveries = dbModule.getUserPendingDeliveries.all(userId);
                
                // Process each original item
                allItems.forEach(item => {
                    // Find if the item was delivered
                    const deliveredItem = deliveredItems.find(
                        d => d.Nom === item.product_name
                    );
                    
                    if (deliveredItem && deliveredItem.quantity > 0) {
                        if (deliveredItem.quantity >= item.quantity) {
                            // Fully delivered or excess quantity - update both status and quantity
                            
                            // Modifier la quantité de l'article original pour refléter la quantité réellement livrée
                            dbModule.updateOrderItemQuantity.run(
                                deliveredItem.quantity, // Utiliser la quantité réellement livrée (même si > commandée)
                                orderId,
                                item.product_name,
                                item.category
                            );
                            
                            // Marquer l'article comme livré
                            dbModule.updateOrderItemStatus.run('delivered', orderId, item.product_name);
                        } else if (deliveredItem.quantity < item.quantity) {
                            // Partially delivered - create two entries
                            const remainingQuantity = item.quantity - deliveredItem.quantity;
                            
                            // Modifier la quantité de l'article original pour refléter ce qui a été livré
                            dbModule.updateOrderItemQuantity.run(
                                deliveredItem.quantity,
                                orderId,
                                item.product_name,
                                item.category
                            );
                            
                            // Marquer l'article comme livré
                            dbModule.updateOrderItemStatus.run('delivered', orderId, item.product_name);
                            
                            // Créer un nouvel article avec la quantité restante
                            dbModule.addOrderItem.run(
                                orderId,
                                item.product_name,
                                item.product_price,
                                remainingQuantity,
                                item.category,
                                'remaining'
                            );
                            
                            // Add to remaining items
                            remainingItems.push({
                                Nom: item.product_name,
                                prix: item.product_price.toString(),
                                quantity: remainingQuantity,
                                categorie: item.category
                            });
                            
                            // Gérer les articles en attente de livraison
                            // Rechercher si l'article existe déjà dans les articles en attente
                            const existingPendingItem = existingPendingDeliveries.find(
                                p => p.product_name === item.product_name && p.category === item.category
                            );
                            
                            if (existingPendingItem) {
                                // L'article est déjà en attente, mettre à jour la quantité
                                // Nous additionnons la quantité restante à la quantité existante
                                const updatedQuantity = existingPendingItem.quantity + remainingQuantity;
                                dbModule.updatePendingDeliveryQuantity.run(
                                    updatedQuantity,
                                    existingPendingItem.id
                                );
                            } else {
                                // L'article n'existe pas encore, l'ajouter
                                dbModule.addPendingDelivery.run(
                                    userId,
                                    item.product_name,
                                    item.product_price,
                                    remainingQuantity,
                                    item.category
                                );
                            }
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
                        
                        // Gérer les articles en attente de livraison
                        // Rechercher si l'article existe déjà dans les articles en attente
                        const existingPendingItem = existingPendingDeliveries.find(
                            p => p.product_name === item.product_name && p.category === item.category
                        );
                        
                        if (existingPendingItem) {
                            // L'article est déjà en attente, mettre à jour la quantité
                            // Nous additionnons la quantité non livrée à la quantité existante
                            const updatedQuantity = existingPendingItem.quantity + item.quantity;
                            dbModule.updatePendingDeliveryQuantity.run(
                                updatedQuantity,
                                existingPendingItem.id
                            );
                        } else {
                            // L'article n'existe pas encore, l'ajouter
                            dbModule.addPendingDelivery.run(
                                userId,
                                item.product_name,
                                item.product_price,
                                item.quantity,
                                item.category
                            );
                        }
                    }
                });
                
                // Déterminer le statut de la commande
                const newStatus = remainingItems.length > 0 ? 'partial' : 'completed';
                
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
    },

    createOrderFromPendingItems(userId, items) {
        try {
            return dbModule.transaction(() => {
                // Dans createNewOrder et createOrderFromPendingItems:
                const now = new Date();
                const year = now.getFullYear().toString().slice(-2); // Derniers 2 chiffres de l'année
                const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Mois (01-12)
                const day = now.getDate().toString().padStart(2, '0'); // Jour (01-31)
                const hour = now.getHours().toString().padStart(2, '0'); // Heure (00-23)
                const minute = now.getMinutes().toString().padStart(2, '0'); // Minutes (00-59)
                const second = now.getSeconds().toString().padStart(2, '0'); // Secondes (00-59)
                const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // Nombre aléatoire de 3 chiffres

                // Format: YYMM-DDHH-MMSSR (Minutes, Secondes, Random)
                const orderId = `${year}${month}-${day}${hour}-${minute}${second}${random}`;
                const date = new Date().toISOString();
                
                // Créer l'enregistrement de commande
                dbModule.createOrder.run(orderId, userId, 'pending', date);
                
                // Ajouter les articles à la commande
                items.forEach(item => {
                    dbModule.addOrderItem.run(
                        orderId,
                        item.Nom,
                        parseFloat(item.prix),
                        item.quantity,
                        item.categorie,
                        'pending'
                    );
                    
                    // Trouver cet article dans les articles en attente de livraison
                    const pendingDeliveryItem = dbModule.findPendingDeliveryItem.get(
                        userId,
                        item.Nom,
                        item.categorie
                    );
                    
                    if (pendingDeliveryItem) {
                        // Si l'article existe dans les livraisons en attente et la quantité est égale,
                        // supprimer l'entrée
                        if (pendingDeliveryItem.quantity === item.quantity) {
                            dbModule.removePendingDelivery.run(pendingDeliveryItem.id);
                        } else if (pendingDeliveryItem.quantity > item.quantity) {
                            // Si la quantité de pending est supérieure, réduire la quantité
                            const newQuantity = pendingDeliveryItem.quantity - item.quantity;
                            dbModule.updatePendingDeliveryQuantity.run(
                                newQuantity,
                                pendingDeliveryItem.id
                            );
                        }
                    }
                });
                
                return {
                    success: true,
                    orderId,
                    message: 'Commande créée avec succès'
                };
            });
        } catch (error) {
            console.error('Error creating order from pending items:', error);
            throw error;
        }
    }
};

module.exports = orderService;