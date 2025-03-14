/*
================================================================================
|                                db.js                                         |
|------------------------------------------------------------------------------|
| Ce fichier est le module central de gestion de la base de données pour      |
| l'application. Il utilise la bibliothèque 'sqlite3' pour gérer une          |
| base de données SQLite et fournit des fonctions et requêtes préparées pour  |
| interagir avec les utilisateurs, les commandes et les produits.             |
================================================================================

1. **Initialisation de la base de données**
   - Vérifie l'existence du dossier `database`, le crée si nécessaire.
   - Définit le chemin de la base de données (`discado.db`).
   - Active les clés étrangères (`PRAGMA foreign_keys = ON`).

2. **Création des tables**
   - `users`: Stocke les informations des utilisateurs (nom, mot de passe, rôle).
   - `user_profiles`: Contient des détails supplémentaires sur les utilisateurs.
   - `products`: Gère les produits disponibles à l'achat.
   - `orders`: Suit les commandes passées par les utilisateurs.
   - `order_items`: Stocke les articles associés à chaque commande.
   - `pending_deliveries`: Gère les articles en attente de livraison.

3. **Fonctions et Requêtes Préparées**
   - Gestion des utilisateurs :
     - Récupération d'un utilisateur (`getUserByUsername`).
     - Création et récupération des utilisateurs (`createUser`, `getAllUsers`).
   - Gestion des profils :
     - Récupération, création et mise à jour des profils (`getUserProfile`, `createUserProfile`, `updateUserProfile`).
   - Gestion des commandes :
     - Création, récupération et mise à jour des commandes (`createOrder`, `getOrderById`, `updateOrderStatus`, etc.).
   - Gestion des articles de commande :
     - Ajout, récupération et mise à jour (`addOrderItem`, `getOrderItems`, `updateOrderItemStatus`, etc.).
   - Gestion des livraisons en attente :
     - Ajout, récupération, suppression et mise à jour (`addPendingDelivery`, `getUserPendingDeliveries`, `removePendingDelivery`, etc.).
   - Support des transactions :
     - `transaction(callback)`: Permet d'exécuter plusieurs opérations de manière atomique.

================================================================================
| Ce fichier centralise toutes les interactions avec la base de données et     |
| garantit une gestion efficace des données de l'application.                  |
================================================================================
*/

// db.js - Central database module
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'discado.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Database initialized successfully');
    }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Initialize database schema
function initDatabase() {
    // Create users table
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `);

    // Create user_profiles table
    db.run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
        username TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        shop_name TEXT,
        shop_address TEXT,
        shop_city TEXT,
        shop_zip_code TEXT,
        last_updated TIMESTAMP,
        FOREIGN KEY (username) REFERENCES users(username)
    )
    `);

    // Create products table
    db.run(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `);

    // Create orders table
    db.run(`
    CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        date TIMESTAMP NOT NULL,
        last_processed TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(username)
    )
    `);

    // Create order_items table
    db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        product_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        category TEXT,
        status TEXT DEFAULT 'pending', -- pending, delivered, remaining
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
    )
    `);

    // Create pending_deliveries table for items waiting to be delivered
    db.run(`
    CREATE TABLE IF NOT EXISTS pending_deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        product_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        category TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(username)
    )
    `, (err) => {
        if (err) {
            console.error('Error creating tables:', err.message);
        } else {
            console.log('All tables created successfully');
        }
    });
}

// Initialize the database
initDatabase();

// Utility function to wrap callback-based database calls in promises
function runAsync(query, ...params) {
    return new Promise((resolve, reject) => {
        db.run(query, ...params, function(err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function getAsync(query, ...params) {
    return new Promise((resolve, reject) => {
        db.get(query, ...params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function allAsync(query, ...params) {
    return new Promise((resolve, reject) => {
        db.all(query, ...params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

// Wrapper for prepared statements with sqlite3
const preparedStatements = {
    // User-related queries
    getUserByUsername: (username) => getAsync('SELECT * FROM users WHERE username = ?', username),
    createUser: (username, password, role) => runAsync('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', username, password, role),
    getAllUsers: () => allAsync('SELECT * FROM users'),
    
    // User profile queries
    getUserProfile: (username) => getAsync('SELECT * FROM user_profiles WHERE username = ?', username),
    createUserProfile: (username, firstName, lastName, email, phone, shopName, shopAddress, shopCity, shopZipCode, lastUpdated) => 
        runAsync(`
            INSERT INTO user_profiles 
            (username, first_name, last_name, email, phone, shop_name, shop_address, shop_city, shop_zip_code, last_updated) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, username, firstName, lastName, email, phone, shopName, shopAddress, shopCity, shopZipCode, lastUpdated),
    updateUserProfile: (firstName, lastName, email, phone, shopName, shopAddress, shopCity, shopZipCode, lastUpdated, username) => 
        runAsync(`
            UPDATE user_profiles 
            SET first_name = ?, last_name = ?, email = ?, phone = ?, 
                shop_name = ?, shop_address = ?, shop_city = ?, shop_zip_code = ?, last_updated = ?
            WHERE username = ?
        `, firstName, lastName, email, phone, shopName, shopAddress, shopCity, shopZipCode, lastUpdated, username),
    getAllProfiles: () => allAsync('SELECT * FROM user_profiles'),
    
    // Order queries
    createOrder: (orderId, userId, status, date) => 
        runAsync('INSERT INTO orders (order_id, user_id, status, date) VALUES (?, ?, ?, ?)', orderId, userId, status, date),
    getOrderById: (orderId) => getAsync('SELECT * FROM orders WHERE order_id = ?', orderId),
    getUserOrders: (userId) => allAsync('SELECT * FROM orders WHERE user_id = ? ORDER BY date DESC', userId),
    getPendingOrders: () => allAsync("SELECT * FROM orders WHERE status = 'pending' ORDER BY date ASC"),
    getTreatedOrders: () => allAsync("SELECT * FROM orders WHERE status IN ('completed', 'partial') ORDER BY date DESC"),
    updateOrderStatus: (status, lastProcessed, orderId) => 
        runAsync('UPDATE orders SET status = ?, last_processed = ? WHERE order_id = ?', status, lastProcessed, orderId),
    
    // Order items queries
    addOrderItem: (orderId, productName, productPrice, quantity, category, status) => 
        runAsync(`
            INSERT INTO order_items (order_id, product_name, product_price, quantity, category, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, orderId, productName, productPrice, quantity, category, status),
    getOrderItems: (orderId) => allAsync('SELECT * FROM order_items WHERE order_id = ?', orderId),
    getOrderItemsByStatus: (orderId, status) => 
        allAsync('SELECT * FROM order_items WHERE order_id = ? AND status = ?', orderId, status),
    updateOrderItemStatus: (status, orderId, productName) => 
        runAsync('UPDATE order_items SET status = ? WHERE order_id = ? AND product_name = ?', status, orderId, productName),
    // Requête pour mettre à jour la quantité d'un article de commande
    updateOrderItemQuantity: (quantity, orderId, productName, category) => 
        runAsync(`
            UPDATE order_items 
            SET quantity = ? 
            WHERE order_id = ? AND product_name = ? AND category = ?
        `, quantity, orderId, productName, category),

    // Requête pour mettre à jour la date d'une commande
    updateOrderDate: (date, orderId) => 
        runAsync(`
            UPDATE orders 
            SET date = ? 
            WHERE order_id = ?
        `, date, orderId),
    
    // Pending deliveries
    addPendingDelivery: (userId, productName, productPrice, quantity, category) => 
        runAsync(`
            INSERT INTO pending_deliveries (user_id, product_name, product_price, quantity, category) 
            VALUES (?, ?, ?, ?, ?)
        `, userId, productName, productPrice, quantity, category),
    getUserPendingDeliveries: (userId) => allAsync('SELECT * FROM pending_deliveries WHERE user_id = ?', userId),
    removePendingDelivery: (id) => runAsync('DELETE FROM pending_deliveries WHERE id = ?', id),
    updatePendingDeliveryQuantity: (quantity, id) => runAsync('UPDATE pending_deliveries SET quantity = ? WHERE id = ?', quantity, id),
    
    // Nouvelle requête pour trouver un article en attente de livraison spécifique
    findPendingDeliveryItem: (userId, productName, category) => 
        getAsync(`
            SELECT * FROM pending_deliveries 
            WHERE user_id = ? AND product_name = ? AND category = ?
        `, userId, productName, category),

    // Transaction wrapper
    transaction: async (callback) => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                try {
                    const result = callback();
                    db.run('COMMIT', (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                } catch (error) {
                    db.run('ROLLBACK');
                    reject(error);
                }
            });
        });
    }
};

// Export database instance and prepared statements
module.exports = {
    db,
    ...preparedStatements,
    
    // Legacy compatibility wrapper for direct database queries
    // This helps support code that expected direct statement execution from better-sqlite3
    prepare: (sql) => {
        console.warn('Using legacy prepare() method. Consider updating to new async API.');
        return {
            run: (...params) => {
                const result = { lastInsertRowid: null };
                db.run(sql, ...params, function(err) {
                    if (err) throw err;
                    result.lastInsertRowid = this.lastID;
                });
                return result;
            },
            get: (...params) => {
                let result = null;
                db.get(sql, ...params, (err, row) => {
                    if (err) throw err;
                    result = row;
                });
                return result;
            },
            all: (...params) => {
                let result = [];
                db.all(sql, ...params, (err, rows) => {
                    if (err) throw err;
                    result = rows;
                });
                return result;
            }
        };
    }
};