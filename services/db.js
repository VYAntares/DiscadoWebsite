// Ce fichier `db.js` est un module central de gestion de la base de données pour une application utilisant **better-sqlite3** avec SQLite. Il définit la structure des tables et fournit des requêtes préparées pour interagir avec la base de données.

// ### **Que fait ce fichier ?**

// 1. **Initialisation de la base de données :**
//    - Il s'assure que le dossier `database/` existe et y crée un fichier `discado.db` s'il n'existe pas.
//    - Il active les **foreign keys** (clé étrangère) pour garantir l'intégrité des relations entre les tables.
//    - Il crée les tables suivantes si elles n'existent pas :
//      - **users** : stocke les informations des utilisateurs.
//      - **user_profiles** : stocke les informations de profil des utilisateurs.
//      - **products** : stocke les produits disponibles.
//      - **orders** : enregistre les commandes passées par les utilisateurs.
//      - **order_items** : détaille les articles inclus dans une commande.
//      - **pending_deliveries** : liste les articles en attente de livraison.

// 2. **Exportation d'instances et de requêtes préparées :**
//    - Il exporte l'instance `db` pour permettre l'exécution de requêtes SQL ailleurs dans l'application.
//    - Il définit et exporte des **requêtes SQL préparées** pour interagir efficacement avec la base :
//      - **Gestion des utilisateurs** : récupérer un utilisateur, créer un utilisateur, lister tous les utilisateurs.
//      - **Gestion des profils** : récupérer, créer et mettre à jour un profil utilisateur.
//      - **Gestion des commandes** : créer une commande, récupérer une commande par ID, récupérer les commandes d'un utilisateur, etc.
//      - **Gestion des articles de commande** : ajouter un article à une commande, récupérer les articles d'une commande, mettre à jour le statut ou la quantité d'un article.
//      - **Gestion des livraisons en attente** : ajouter, récupérer et modifier des articles en attente de livraison.

// 3. **Gestion des transactions :**
//    - Il définit une fonction `transaction(callback)`, qui permet d'exécuter des requêtes en transaction pour garantir l'intégrité des opérations complexes.

// ---

// ### **Pourquoi utiliser better-sqlite3 ?**
// - Il permet d'exécuter des requêtes SQL de manière **synchronisée** sans devoir gérer des callbacks ou des promesses.
// - Il est **plus rapide** que `sqlite3` (module classique) car il fonctionne en mode natif avec SQLite.
// - Il prend en charge **les requêtes préparées**, ce qui améliore la **sécurité** (évite les injections SQL) et **les performances**.

// ---

// ### **Conclusion**
// Ce fichier sert de **couche d'abstraction** entre l'application et la base de données SQLite. Il assure la création des tables et fournit des fonctions prêtes à l'emploi pour manipuler les utilisateurs, les commandes et les livraisons. Il permet ainsi d'interagir avec la base de manière **simple, efficace et sécurisée**. 🚀

// db.js - Central database module
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'discado.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initDatabase() {
    // Create users table
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `);

    // Create user_profiles table
    db.exec(`
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
    db.exec(`
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
    db.exec(`
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
    db.exec(`
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
    db.exec(`
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
    `);

    console.log('Database initialized successfully');
}

// Initialize the database
initDatabase();

// Export database instance and prepared statements
module.exports = {
    db,
    
    // User-related queries
    getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    createUser: db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)'),
    getAllUsers: db.prepare('SELECT * FROM users'),
    
    // User profile queries
    getUserProfile: db.prepare('SELECT * FROM user_profiles WHERE username = ?'),
    createUserProfile: db.prepare(`
        INSERT INTO user_profiles 
        (username, first_name, last_name, email, phone, shop_name, shop_address, shop_city, shop_zip_code, last_updated) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateUserProfile: db.prepare(`
        UPDATE user_profiles 
        SET first_name = ?, last_name = ?, email = ?, phone = ?, 
            shop_name = ?, shop_address = ?, shop_city = ?, shop_zip_code = ?, last_updated = ?
        WHERE username = ?
    `),
    getAllProfiles: db.prepare('SELECT * FROM user_profiles'),
    
    // Order queries
    createOrder: db.prepare('INSERT INTO orders (order_id, user_id, status, date) VALUES (?, ?, ?, ?)'),
    getOrderById: db.prepare('SELECT * FROM orders WHERE order_id = ?'),
    getUserOrders: db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY date DESC'),
    getPendingOrders: db.prepare("SELECT * FROM orders WHERE status = 'pending' ORDER BY date ASC"),
    getTreatedOrders: db.prepare("SELECT * FROM orders WHERE status IN ('completed', 'partial') ORDER BY date DESC"),
    updateOrderStatus: db.prepare('UPDATE orders SET status = ?, last_processed = ? WHERE order_id = ?'),
    
    // Order items queries
    addOrderItem: db.prepare(`
        INSERT INTO order_items (order_id, product_name, product_price, quantity, category, status) 
        VALUES (?, ?, ?, ?, ?, ?)
    `),
    getOrderItems: db.prepare('SELECT * FROM order_items WHERE order_id = ?'),
    getOrderItemsByStatus: db.prepare('SELECT * FROM order_items WHERE order_id = ? AND status = ?'),
    updateOrderItemStatus: db.prepare('UPDATE order_items SET status = ? WHERE order_id = ? AND product_name = ?'),
    // Requête pour mettre à jour la quantité d'un article de commande
    updateOrderItemQuantity: db.prepare(`
        UPDATE order_items 
        SET quantity = ? 
        WHERE order_id = ? AND product_name = ? AND category = ?
    `),

    // Requête pour mettre à jour la date d'une commande
    updateOrderDate: db.prepare(`
        UPDATE orders 
        SET date = ? 
        WHERE order_id = ?
    `),
    
    // Pending deliveries
    addPendingDelivery: db.prepare(`
        INSERT INTO pending_deliveries (user_id, product_name, product_price, quantity, category) 
        VALUES (?, ?, ?, ?, ?)
    `),
    getUserPendingDeliveries: db.prepare('SELECT * FROM pending_deliveries WHERE user_id = ?'),
    removePendingDelivery: db.prepare('DELETE FROM pending_deliveries WHERE id = ?'),
    updatePendingDeliveryQuantity: db.prepare('UPDATE pending_deliveries SET quantity = ? WHERE id = ?'),
    
    // Nouvelle requête pour trouver un article en attente de livraison spécifique
    findPendingDeliveryItem: db.prepare(`
        SELECT * FROM pending_deliveries 
        WHERE user_id = ? AND product_name = ? AND category = ?
    `),

    // Transaction wrapper
    transaction: (callback) => {
        const runTransaction = db.transaction(callback);
        return runTransaction();
    }
};