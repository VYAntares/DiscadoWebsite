// db.js - Adapté pour fonctionner sur Render avec NeDB (100% JavaScript)
const Datastore = require('nedb');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

// Ensure database directory exists
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Mode d'utilisation (mémoire pour Render, fichiers pour développement local)
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Mode: ${isProduction ? 'Production (base en mémoire)' : 'Développement (base fichier)'}`);

// Initialiser les bases de données (une par table)
const users = new Datastore({
    inMemory: isProduction,
    filename: isProduction ? null : path.join(dbDir, 'users.db'),
    autoload: !isProduction
});

const userProfiles = new Datastore({
    inMemory: isProduction,
    filename: isProduction ? null : path.join(dbDir, 'user_profiles.db'),
    autoload: !isProduction
});

const products = new Datastore({
    inMemory: isProduction,
    filename: isProduction ? null : path.join(dbDir, 'products.db'),
    autoload: !isProduction
});

const orders = new Datastore({
    inMemory: isProduction,
    filename: isProduction ? null : path.join(dbDir, 'orders.db'),
    autoload: !isProduction
});

const orderItems = new Datastore({
    inMemory: isProduction,
    filename: isProduction ? null : path.join(dbDir, 'order_items.db'),
    autoload: !isProduction
});

const pendingDeliveries = new Datastore({
    inMemory: isProduction,
    filename: isProduction ? null : path.join(dbDir, 'pending_deliveries.db'),
    autoload: !isProduction
});

// Promisifier les méthodes NeDB
const findOne = (db, query) => {
    return new Promise((resolve, reject) => {
        db.findOne(query, (err, doc) => {
            if (err) reject(err);
            else resolve(doc);
        });
    });
};

const find = (db, query, sort = {}) => {
    return new Promise((resolve, reject) => {
        db.find(query).sort(sort).exec((err, docs) => {
            if (err) reject(err);
            else resolve(docs);
        });
    });
};

const insert = (db, doc) => {
    return new Promise((resolve, reject) => {
        db.insert(doc, (err, newDoc) => {
            if (err) reject(err);
            else resolve(newDoc);
        });
    });
};

const update = (db, query, update, options = {}) => {
    return new Promise((resolve, reject) => {
        db.update(query, update, options, (err, numAffected) => {
            if (err) reject(err);
            else resolve({ changes: numAffected });
        });
    });
};

const remove = (db, query, options = {}) => {
    return new Promise((resolve, reject) => {
        db.remove(query, options, (err, numRemoved) => {
            if (err) reject(err);
            else resolve({ changes: numRemoved });
        });
    });
};

// Initialiser les bases de données, créer des données de test
async function initDatabase() {
    try {
        if (isProduction) {
            // Données de test pour l'admin
            await insert(users, {
                username: 'admin',
                password: 'admin',
                role: 'admin',
                created_at: new Date().toISOString()
            });

            // Données de test pour le client
            await insert(users, {
                username: 'client',
                password: 'client',
                role: 'client',
                created_at: new Date().toISOString()
            });

            // Profil du client de test
            await insert(userProfiles, {
                username: 'client',
                first_name: 'Jean',
                last_name: 'Dupont',
                email: 'jean@example.com',
                phone: '0123456789',
                shop_name: 'Boutique Test',
                shop_address: '123 Rue Test',
                shop_city: 'Ville Test',
                shop_zip_code: '12345',
                last_updated: new Date().toISOString()
            });

            // Quelques produits de test
            await insert(products, {
                name: 'Produit Test 1',
                price: 9.99,
                category: 'Category1',
                image_url: '/images/category1/product1.jpg',
                created_at: new Date().toISOString()
            });

            await insert(products, {
                name: 'Produit Test 2',
                price: 19.99,
                category: 'Category2',
                image_url: '/images/category2/product2.jpg',
                created_at: new Date().toISOString()
            });

            console.log('Données de test ajoutées avec succès');
        }
    } catch (error) {
        console.error('Erreur lors de l\'initialisation des données de test:', error);
    }
}

// Indexer les bases de données
users.ensureIndex({ fieldName: 'username', unique: true });
userProfiles.ensureIndex({ fieldName: 'username', unique: true });
orders.ensureIndex({ fieldName: 'order_id', unique: true });
orderItems.ensureIndex({ fieldName: 'id', unique: true });
pendingDeliveries.ensureIndex({ fieldName: 'id', unique: true });

// Initialiser la base de données
initDatabase();

// Exporter le module avec une interface compatible avec le code existant
module.exports = {
    // Propriété db pour la compatibilité
    db: { 
        users, userProfiles, products, orders, orderItems, pendingDeliveries 
    },

    // User-related queries
    getUserByUsername: {
        get: (username) => findOne(users, { username })
    },
    createUser: {
        run: async (username, password, role) => {
            const result = await insert(users, {
                username,
                password,
                role,
                created_at: new Date().toISOString()
            });
            return { lastID: result._id, changes: 1 };
        }
    },
    getAllUsers: {
        all: () => find(users, {})
    },

    // User profile queries
    getUserProfile: {
        get: (username) => findOne(userProfiles, { username })
    },
    createUserProfile: {
        run: async (username, firstName, lastName, email, phone, shopName, shopAddress, shopCity, shopZipCode, lastUpdated) => {
            const result = await insert(userProfiles, {
                username,
                first_name: firstName,
                last_name: lastName,
                email,
                phone,
                shop_name: shopName,
                shop_address: shopAddress,
                shop_city: shopCity,
                shop_zip_code: shopZipCode,
                last_updated: lastUpdated
            });
            return { lastID: result._id, changes: 1 };
        }
    },
    updateUserProfile: {
        run: (firstName, lastName, email, phone, shopName, shopAddress, shopCity, shopZipCode, lastUpdated, username) => {
            return update(
                userProfiles,
                { username },
                {
                    $set: {
                        first_name: firstName,
                        last_name: lastName,
                        email,
                        phone,
                        shop_name: shopName,
                        shop_address: shopAddress,
                        shop_city: shopCity,
                        shop_zip_code: shopZipCode,
                        last_updated: lastUpdated
                    }
                }
            );
        }
    },
    getAllProfiles: {
        all: () => find(userProfiles, {})
    },

    // Order queries
    createOrder: {
        run: (orderId, userId, status, date) => {
            return insert(orders, {
                order_id: orderId,
                user_id: userId,
                status,
                date
            });
        }
    },
    getOrderById: {
        get: (orderId) => findOne(orders, { order_id: orderId })
    },
    getUserOrders: {
        all: (userId) => find(orders, { user_id: userId }, { date: -1 })
    },
    getPendingOrders: {
        all: () => find(orders, { status: 'pending' }, { date: 1 })
    },
    getTreatedOrders: {
        all: () => find(orders, { status: { $in: ['completed', 'partial'] } }, { date: -1 })
    },
    updateOrderStatus: {
        run: (status, lastProcessed, orderId) => {
            return update(
                orders,
                { order_id: orderId },
                { $set: { status, last_processed: lastProcessed } }
            );
        }
    },

    // Order items queries
    addOrderItem: {
        run: async (orderId, productName, productPrice, quantity, category, status) => {
            // Générer un ID unique pour l'item
            const id = Date.now() + Math.floor(Math.random() * 1000);
            
            const result = await insert(orderItems, {
                id,
                order_id: orderId,
                product_name: productName,
                product_price: productPrice,
                quantity,
                category,
                status: status || 'pending'
            });
            
            return { lastID: result._id, changes: 1 };
        }
    },
    getOrderItems: {
        all: (orderId) => find(orderItems, { order_id: orderId })
    },
    getOrderItemsByStatus: {
        all: (orderId, status) => find(orderItems, { order_id: orderId, status })
    },
    updateOrderItemStatus: {
        run: (status, orderId, productName) => {
            return update(
                orderItems,
                { order_id: orderId, product_name: productName },
                { $set: { status } },
                { multi: true }
            );
        }
    },
    updateOrderItemQuantity: {
        run: (quantity, orderId, productName, category) => {
            return update(
                orderItems,
                { order_id: orderId, product_name: productName, category },
                { $set: { quantity } }
            );
        }
    },
    updateOrderDate: {
        run: (date, orderId) => {
            return update(
                orders,
                { order_id: orderId },
                { $set: { date } }
            );
        }
    },

    // Pending deliveries
    addPendingDelivery: {
        run: async (userId, productName, productPrice, quantity, category) => {
            // Générer un ID unique
            const id = Date.now() + Math.floor(Math.random() * 1000);
            
            const result = await insert(pendingDeliveries, {
                id,
                user_id: userId,
                product_name: productName,
                product_price: productPrice,
                quantity,
                category,
                created_at: new Date().toISOString()
            });
            
            return { lastID: result._id, changes: 1 };
        }
    },
    getUserPendingDeliveries: {
        all: (userId) => find(pendingDeliveries, { user_id: userId })
    },
    removePendingDelivery: {
        run: (id) => remove(pendingDeliveries, { id })
    },
    updatePendingDeliveryQuantity: {
        run: (quantity, id) => {
            return update(
                pendingDeliveries,
                { id },
                { $set: { quantity } }
            );
        }
    },
    findPendingDeliveryItem: {
        get: (userId, productName, category) => {
            return findOne(pendingDeliveries, {
                user_id: userId,
                product_name: productName,
                category
            });
        }
    },

    // Transaction wrapper
    transaction: async (callback) => {
        try {
            return await callback();
        } catch (error) {
            console.error('Transaction error:', error);
            throw error;
        }
    }
};