// db.js - Central database module modifié pour Render
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Pour Render, utiliser une base de données en mémoire en production
// et le fichier normal en développement
const isProduction = process.env.NODE_ENV === 'production';
const dbPath = isProduction ? ':memory:' : path.join(dbDir, 'discado.db');
const db = new sqlite3.Database(dbPath);

console.log(`Base de données SQLite initialisée en mode ${isProduction ? 'mémoire' : 'fichier'}`);

// Promisify db methods
const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) {
                console.error('Erreur SQL (run):', query, err);
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
};

const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) {
                console.error('Erreur SQL (get):', query, err);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Erreur SQL (all):', query, err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Initialize database schema
async function initDatabase() {
    try {
        // Create users table
        await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        `);

        // Create user_profiles table
        await dbRun(`
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
        await dbRun(`
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
        await dbRun(`
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
        await dbRun(`
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            product_price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            category TEXT,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (order_id) REFERENCES orders(order_id)
        )
        `);

        // Create pending_deliveries table
        await dbRun(`
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
        
        // Si en production, ajouter des données de test
        if (isProduction) {
            await addTestData();
        }
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Ajouter des données de test en mode production (base en mémoire)
async function addTestData() {
    try {
        // Ajouter utilisateur admin
        await dbRun(
            'INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)',
            ['admin', 'admin', 'admin']
        );
        
        // Ajouter utilisateur client
        await dbRun(
            'INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)',
            ['client', 'client', 'client']
        );
        
        // Ajouter profil client
        await dbRun(`
            INSERT OR IGNORE INTO user_profiles 
            (username, first_name, last_name, email, phone, shop_name, shop_address, shop_city, shop_zip_code, last_updated) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['client', 'Jean', 'Dupont', 'jean@example.com', '0123456789', 
             'Boutique Test', '123 Rue Test', 'Ville Test', '12345', new Date().toISOString()]
        );
        
        console.log('Test data added successfully');
    } catch (error) {
        console.error('Error adding test data:', error);
    }
}

// Initialize the database
initDatabase();

// Export database instance and prepared statements adaptés pour sqlite3
module.exports = {
    db,
    
    // User-related queries
    getUserByUsername: {
        get: (username) => dbGet('SELECT * FROM users WHERE username = ?', [username])
    },
    createUser: {
        run: (username, password, role) => 
            dbRun('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role])
    },
    getAllUsers: {
        all: () => dbAll('SELECT * FROM users')
    },
    
    // User profile queries
    getUserProfile: {
        get: (username) => dbGet('SELECT * FROM user_profiles WHERE username = ?', [username])
    },
    createUserProfile: {
        run: (username, firstName, lastName, email, phone, shopName, shopAddress, shopCity, shopZipCode, lastUpdated) =>
            dbRun(`
                INSERT INTO user_profiles 
                (username, first_name, last_name, email, phone, shop_name, shop_address, shop_city, shop_zip_code, last_updated) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [username, firstName, lastName, email, phone, shopName, shopAddress, shopCity, shopZipCode, lastUpdated])
    },
    updateUserProfile: {
        run: (firstName, lastName, email, phone, shopName, shopAddress, shopCity, shopZipCode, lastUpdated, username) =>
            dbRun(`
                UPDATE user_profiles 
                SET first_name = ?, last_name = ?, email = ?, phone = ?, 
                    shop_name = ?, shop_address = ?, shop_city = ?, shop_zip_code = ?, last_updated = ?
                WHERE username = ?
            `, [firstName, lastName, email, phone, shopName, shopAddress, shopCity, shopZipCode, lastUpdated, username])
    },
    getAllProfiles: {
        all: () => dbAll('SELECT * FROM user_profiles')
    },
    
    // Order queries
    createOrder: {
        run: (orderId, userId, status, date) => 
            dbRun('INSERT INTO orders (order_id, user_id, status, date) VALUES (?, ?, ?, ?)', 
                [orderId, userId, status, date])
    },
    getOrderById: {
        get: (orderId) => dbGet('SELECT * FROM orders WHERE order_id = ?', [orderId])
    },
    getUserOrders: {
        all: (userId) => dbAll('SELECT * FROM orders WHERE user_id = ? ORDER BY date DESC', [userId])
    },
    getPendingOrders: {
        all: () => dbAll("SELECT * FROM orders WHERE status = 'pending' ORDER BY date ASC")
    },
    getTreatedOrders: {
        all: () => dbAll("SELECT * FROM orders WHERE status IN ('completed', 'partial') ORDER BY date DESC")
    },
    updateOrderStatus: {
        run: (status, lastProcessed, orderId) => 
            dbRun('UPDATE orders SET status = ?, last_processed = ? WHERE order_id = ?', 
                [status, lastProcessed, orderId])
    },
    
    // Order items queries
    addOrderItem: {
        run: (orderId, productName, productPrice, quantity, category, status) => 
            dbRun(`
                INSERT INTO order_items (order_id, product_name, product_price, quantity, category, status) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, [orderId, productName, productPrice, quantity, category, status])
    },
    getOrderItems: {
        all: (orderId) => dbAll('SELECT * FROM order_items WHERE order_id = ?', [orderId])
    },
    getOrderItemsByStatus: {
        all: (orderId, status) => dbAll('SELECT * FROM order_items WHERE order_id = ? AND status = ?', [orderId, status])
    },
    updateOrderItemStatus: {
        run: (status, orderId, productName) => 
            dbRun('UPDATE order_items SET status = ? WHERE order_id = ? AND product_name = ?', 
                [status, orderId, productName])
    },
    updateOrderItemQuantity: {
        run: (quantity, orderId, productName, category) => 
            dbRun(`
                UPDATE order_items 
                SET quantity = ? 
                WHERE order_id = ? AND product_name = ? AND category = ?
            `, [quantity, orderId, productName, category])
    },
    updateOrderDate: {
        run: (date, orderId) => 
            dbRun(`
                UPDATE orders 
                SET date = ? 
                WHERE order_id = ?
            `, [date, orderId])
    },
    
    // Pending deliveries
    addPendingDelivery: {
        run: (userId, productName, productPrice, quantity, category) => 
            dbRun(`
                INSERT INTO pending_deliveries (user_id, product_name, product_price, quantity, category) 
                VALUES (?, ?, ?, ?, ?)
            `, [userId, productName, productPrice, quantity, category])
    },
    getUserPendingDeliveries: {
        all: (userId) => dbAll('SELECT * FROM pending_deliveries WHERE user_id = ?', [userId])
    },
    removePendingDelivery: {
        run: (id) => dbRun('DELETE FROM pending_deliveries WHERE id = ?', [id])
    },
    updatePendingDeliveryQuantity: {
        run: (quantity, id) => dbRun('UPDATE pending_deliveries SET quantity = ? WHERE id = ?', [quantity, id])
    },
    findPendingDeliveryItem: {
        get: (userId, productName, category) => 
            dbGet(`
                SELECT * FROM pending_deliveries 
                WHERE user_id = ? AND product_name = ? AND category = ?
            `, [userId, productName, category])
    },
    
    // Transaction wrapper
    transaction: async (callback) => {
        try {
            await dbRun('BEGIN TRANSACTION');
            const result = await callback();
            await dbRun('COMMIT');
            return result;
        } catch (error) {
            await dbRun('ROLLBACK');
            throw error;
        }
    }
};