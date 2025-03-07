// migrateData.js - Migrate data from files to SQLite database
const fs = require('fs');
const path = require('path');
const dbModule = require('./db');
const userService = require('./userService');
const orderService = require('./orderService');
const productService = require('./productService');

console.log('Starting data migration...');

// 1. Create database directory if it doesn't exist
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('Created database directory');
}

// 2. Migrate users
async function migrateUsers() {
    console.log('Migrating users...');
    
    // Predefined users from the original code
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
    
    // Check if users already exist
    const userCount = dbModule.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    
    if (userCount === 0) {
        console.log('Adding default users to database...');
        
        let successCount = 0;
        
        // Add users individually (without transaction)
        for (const user of allowedUsers) {
            try {
                dbModule.createUser.run(user.username, user.password, user.role);
                successCount++;
            } catch (error) {
                console.error(`Error adding user ${user.username}:`, error.message);
            }
        }
        
        console.log(`Added ${successCount} users to database`);
    } else {
        console.log(`Users already exist in database (${userCount} users)`);
    }
}

// 3. Migrate user profiles
async function migrateProfiles() {
    console.log('Migrating user profiles...');
    
    // Get existing profile count
    const profileCount = dbModule.db.prepare('SELECT COUNT(*) as count FROM user_profiles').get().count;
    
    if (profileCount > 0) {
        console.log(`User profiles already exist in database (${profileCount} profiles)`);
        return;
    }
    
    const dataClientDir = path.join(__dirname, 'data_client');
    
    if (!fs.existsSync(dataClientDir)) {
        console.log('No data_client directory found - skipping profile migration');
        return;
    }
    
    const profileFiles = fs.readdirSync(dataClientDir)
        .filter(file => file.endsWith('_profile.json'));
    
    if (profileFiles.length === 0) {
        console.log('No profile files found - skipping profile migration');
        return;
    }
    
    console.log(`Found ${profileFiles.length} profile files to migrate`);
    let successCount = 0;
    
    for (const file of profileFiles) {
        try {
            const username = file.split('_')[0];
            const filePath = path.join(dataClientDir, file);
            const profileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Save profile to database through service
            userService.saveUserProfile(profileData, username);
            successCount++;
        } catch (error) {
            console.error(`Error migrating profile from file ${file}:`, error.message);
        }
    }
    
    console.log(`Successfully migrated ${successCount} user profiles`);
}

// 4. Migrate products from CSV
async function migrateProducts() {
    console.log('Migrating products...');
    
    // Check if products already exist
    const productCount = dbModule.db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    
    if (productCount > 0) {
        console.log(`Products already exist in database (${productCount} products)`);
        return;
    }
    
    try {
        // Use the product service's method that already handles CSV import
        const products = await productService._getLegacyProducts();
        
        if (products.length === 0) {
            console.log('No products found in CSV files - skipping product migration');
            return;
        }
        
        console.log(`Found ${products.length} products to migrate`);
        
        // Insert products in batches to improve performance
        const batchSize = 100;
        let successCount = 0;
        
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            
            // Use a manual transaction
            const insertMany = dbModule.db.transaction((products) => {
                for (const product of batch) {
                    if (!product.Nom || !product.prix) continue;
                    
                    try {
                        dbModule.db.prepare(`
                            INSERT INTO products (name, price, category, image_url)
                            VALUES (?, ?, ?, ?)
                        `).run(
                            product.Nom,
                            parseFloat(product.prix),
                            product.categorie || 'default',
                            product.imageUrl || ''
                        );
                        successCount++;
                    } catch (error) {
                        console.error(`Error inserting product ${product.Nom}:`, error.message);
                    }
                }
            });
            
            // Execute the transaction
            insertMany(batch);
            
            console.log(`Migrated batch ${i/batchSize + 1} (${Math.min(i + batchSize, products.length)}/${products.length} products)`);
        }
        
        console.log(`Successfully migrated ${successCount} products`);
    } catch (error) {
        console.error('Error migrating products:', error.message);
    }
}

// 5. Migrate orders
async function migrateOrders() {
    console.log('Migrating orders...');
    
    // Check if orders already exist
    const orderCount = dbModule.db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    
    if (orderCount > 0) {
        console.log(`Orders already exist in database (${orderCount} orders)`);
        return;
    }
    
    const dataStoreDir = path.join(__dirname, 'data_store');
    
    if (!fs.existsSync(dataStoreDir)) {
        console.log('No data_store directory found - skipping order migration');
        return;
    }
    
    // Look for user order directories
    const userDirs = fs.readdirSync(dataStoreDir)
        .filter(item => {
            const itemPath = path.join(dataStoreDir, item);
            return fs.statSync(itemPath).isDirectory() && item.endsWith('_orders');
        });
    
    if (userDirs.length === 0) {
        console.log('No user order directories found - skipping order migration');
        return;
    }
    
    console.log(`Found ${userDirs.length} user order directories to check`);
    let totalOrdersMigrated = 0;
    
    for (const userDir of userDirs) {
        try {
            const userId = userDir.replace('_orders', '');
            console.log(`Migrating orders for user ${userId}...`);
            
            // Check if user exists in the database
            const user = dbModule.getUserByUsername.get(userId);
            
            if (!user) {
                console.log(`User ${userId} not found in database - creating temporary record`);
                dbModule.createUser.run(userId, 'temporary', 'client');
            }
            
            // First, check the legacy format file
            const legacyOrdersPath = path.join(dataStoreDir, `${userId}_orders.json`);
            
            if (fs.existsSync(legacyOrdersPath)) {
                try {
                    const fileContent = fs.readFileSync(legacyOrdersPath, 'utf8');
                    const orders = JSON.parse(fileContent);
                    
                    if (orders.length > 0) {
                        console.log(`Found ${orders.length} orders in legacy file for user ${userId}`);
                        
                        // Using orderService to migrate each order individually
                        for (const order of orders) {
                            try {
                                // Skip special pending delivery "order"
                                if (order.orderId === 'pending-delivery' || order.isToDeliverItems) {
                                    continue;
                                }
                                
                                // Check if order already exists in database
                                const existingOrder = dbModule.getOrderById.get(order.orderId);
                                
                                if (existingOrder) {
                                    continue; // Skip if already exists
                                }
                                
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
                                    for (const item of order.items) {
                                        dbModule.addOrderItem.run(
                                            order.orderId,
                                            item.Nom,
                                            parseFloat(item.prix),
                                            item.quantity,
                                            item.categorie,
                                            'pending'
                                        );
                                    }
                                }
                                
                                // Add delivered items if they exist
                                if (order.deliveredItems) {
                                    for (const item of order.deliveredItems) {
                                        // Update status to delivered
                                        dbModule.updateOrderItemStatus.run(
                                            'delivered',
                                            order.orderId,
                                            item.Nom
                                        );
                                    }
                                }
                                
                                // Add remaining items if they exist
                                if (order.remainingItems) {
                                    for (const item of order.remainingItems) {
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
                                    }
                                }
                                
                                totalOrdersMigrated++;
                            } catch (error) {
                                console.error(`Error migrating order ${order.orderId}:`, error.message);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error reading legacy orders file for ${userId}:`, error.message);
                }
                
                continue; // Skip directory checking if legacy file exists
            }
            
            // Next, check the directory structure
            const userOrderPath = path.join(dataStoreDir, userDir);
            
            // Check for orders in pending directory
            const pendingDir = path.join(userOrderPath, 'pending');
            if (fs.existsSync(pendingDir)) {
                const pendingFiles = fs.readdirSync(pendingDir).filter(file => file.endsWith('.json'));
                
                if (pendingFiles.length > 0) {
                    console.log(`Found ${pendingFiles.length} pending orders for user ${userId}`);
                    
                    for (const file of pendingFiles) {
                        try {
                            const orderPath = path.join(pendingDir, file);
                            const order = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
                            
                            // Check if order already exists
                            const existingOrder = dbModule.getOrderById.get(order.orderId);
                            if (existingOrder) continue;
                            
                            // Create order
                            dbModule.createOrder.run(
                                order.orderId,
                                userId,
                                order.status || 'pending',
                                order.date
                            );
                            
                            // Add items
                            if (order.items) {
                                for (const item of order.items) {
                                    dbModule.addOrderItem.run(
                                        order.orderId,
                                        item.Nom,
                                        parseFloat(item.prix),
                                        item.quantity,
                                        item.categorie,
                                        'pending'
                                    );
                                }
                            }
                            
                            totalOrdersMigrated++;
                        } catch (error) {
                            console.error(`Error migrating pending order file ${file}:`, error.message);
                        }
                    }
                }
            }
            
            // Check for orders in treated directory
            const treatedDir = path.join(userOrderPath, 'treated');
            if (fs.existsSync(treatedDir)) {
                const treatedFiles = fs.readdirSync(treatedDir).filter(file => file.endsWith('.json'));
                
                if (treatedFiles.length > 0) {
                    console.log(`Found ${treatedFiles.length} treated orders for user ${userId}`);
                    
                    for (const file of treatedFiles) {
                        try {
                            const orderPath = path.join(treatedDir, file);
                            const order = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
                            
                            // Check if order already exists
                            const existingOrder = dbModule.getOrderById.get(order.orderId);
                            if (existingOrder) continue;
                            
                            // Create order
                            dbModule.createOrder.run(
                                order.orderId,
                                userId,
                                order.status || 'completed',
                                order.date
                            );
                            
                            // Set last processed date
                            if (order.lastProcessed) {
                                dbModule.updateOrderStatus.run(
                                    order.status,
                                    order.lastProcessed,
                                    order.orderId
                                );
                            }
                            
                            // Add delivered items
                            if (order.deliveredItems) {
                                for (const item of order.deliveredItems) {
                                    dbModule.addOrderItem.run(
                                        order.orderId,
                                        item.Nom,
                                        parseFloat(item.prix),
                                        item.quantity,
                                        item.categorie,
                                        'delivered'
                                    );
                                }
                            }
                            
                            // Add remaining items
                            if (order.remainingItems) {
                                for (const item of order.remainingItems) {
                                    dbModule.addOrderItem.run(
                                        order.orderId,
                                        item.Nom,
                                        parseFloat(item.prix),
                                        item.quantity,
                                        item.categorie,
                                        'remaining'
                                    );
                                    
                                    // Add to pending deliveries
                                    dbModule.addPendingDelivery.run(
                                        userId,
                                        item.Nom,
                                        parseFloat(item.prix),
                                        item.quantity,
                                        item.categorie
                                    );
                                }
                            }
                            
                            totalOrdersMigrated++;
                        } catch (error) {
                            console.error(`Error migrating treated order file ${file}:`, error.message);
                        }
                    }
                }
            }
            
            // Migrate pending deliveries
            const toDeliverDir = path.join(userOrderPath, 'to-deliver');
            const toDeliverPath = path.join(toDeliverDir, 'to-deliver.json');
            
            if (fs.existsSync(toDeliverPath)) {
                try {
                    const toDeliverItems = JSON.parse(fs.readFileSync(toDeliverPath, 'utf8'));
                    
                    if (toDeliverItems.length > 0) {
                        console.log(`Found ${toDeliverItems.length} pending delivery items for user ${userId}`);
                        
                        for (const item of toDeliverItems) {
                            try {
                                dbModule.addPendingDelivery.run(
                                    userId,
                                    item.Nom,
                                    parseFloat(item.prix),
                                    item.quantity,
                                    item.categorie
                                );
                            } catch (error) {
                                console.error(`Error adding pending delivery item ${item.Nom}:`, error.message);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error migrating pending deliveries for user ${userId}:`, error.message);
                }
            }
        } catch (error) {
            console.error(`Error processing orders for directory ${userDir}:`, error.message);
        }
    }
    
    console.log(`Successfully migrated ${totalOrdersMigrated} orders in total`);
}

// Run all migrations
async function runMigrations() {
    try {
        await migrateUsers();
        await migrateProfiles();
        await migrateProducts();
        await migrateOrders();
        
        console.log('All migrations completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

runMigrations();