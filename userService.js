// userService.js - Handle user and profile operations
const dbModule = require('./db');
const fs = require('fs');
const path = require('path');

// Service for managing users and profiles
const userService = {
    // Get a user by username
    getUser(username) {
        return dbModule.getUserByUsername.get(username);
    },
    
    // Get all users
    getAllUsers() {
        return dbModule.getAllUsers.all();
    },
    
    // Create a new user
    createUser(username, password, role) {
        try {
            return dbModule.createUser.run(username, password, role);
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    },
    
    // Get user profile
    getUserProfile(username) {
        try {
            // First try to get from database
            const profile = dbModule.getUserProfile.get(username);
            
            if (profile) {
                // Format profile to match expected structure
                return {
                    clientId: username,
                    firstName: profile.first_name,
                    lastName: profile.last_name,
                    fullName: `${profile.first_name} ${profile.last_name}`,
                    email: profile.email,
                    phone: profile.phone,
                    shopName: profile.shop_name,
                    shopAddress: profile.shop_address,
                    shopCity: profile.shop_city,
                    shopZipCode: profile.shop_zip_code,
                    lastUpdated: profile.last_updated
                };
            }
            
            // If not in database, try legacy file system
            const legacyProfilePath = path.join(__dirname, 'data_client', `${username}_profile.json`);
            
            if (fs.existsSync(legacyProfilePath)) {
                const profileData = JSON.parse(fs.readFileSync(legacyProfilePath, 'utf8'));
                
                // Migrate profile to database for future use
                this.saveUserProfile(profileData, username);
                
                return profileData;
            }
            
            return null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    },
    
    // Save user profile
    saveUserProfile(profileData, username) {
        try {
            // Normalize data
            const normalizedData = {
                firstName: profileData.firstName || '',
                lastName: profileData.lastName || '',
                email: profileData.email || '',
                phone: profileData.phone || '',
                shopName: profileData.shopName || '',
                shopAddress: profileData.shopAddress || profileData.address || '',
                shopCity: profileData.shopCity || profileData.city || '',
                shopZipCode: profileData.shopZipCode || profileData.postalCode || '',
                lastUpdated: profileData.lastUpdated || new Date().toISOString()
            };
            
            // Check if profile exists
            const existingProfile = dbModule.getUserProfile.get(username);
            
            if (existingProfile) {
                // Update existing profile
                dbModule.updateUserProfile.run(
                    normalizedData.firstName,
                    normalizedData.lastName,
                    normalizedData.email,
                    normalizedData.phone,
                    normalizedData.shopName,
                    normalizedData.shopAddress,
                    normalizedData.shopCity,
                    normalizedData.shopZipCode,
                    normalizedData.lastUpdated,
                    username
                );
            } else {
                // Create new profile
                dbModule.createUserProfile.run(
                    username,
                    normalizedData.firstName,
                    normalizedData.lastName,
                    normalizedData.email,
                    normalizedData.phone,
                    normalizedData.shopName,
                    normalizedData.shopAddress,
                    normalizedData.shopCity,
                    normalizedData.shopZipCode,
                    normalizedData.lastUpdated
                );
            }
            
            // Also save to legacy file system during transition period
            this._saveLegacyProfile(profileData, username);
            
            return { success: true };
        } catch (error) {
            console.error('Error saving user profile:', error);
            throw error;
        }
    },
    
    // Get all client profiles (for admin)
    getAllClientProfiles() {
        try {
            const profiles = dbModule.getAllProfiles.all();
            
            return profiles.map(profile => ({
                clientId: profile.username,
                firstName: profile.first_name,
                lastName: profile.last_name,
                fullName: `${profile.first_name} ${profile.last_name}`,
                email: profile.email,
                phone: profile.phone,
                shopName: profile.shop_name,
                shopAddress: profile.shop_address,
                shopCity: profile.shop_city,
                shopZipCode: profile.shop_zip_code,
                lastUpdated: profile.last_updated
            }));
        } catch (error) {
            console.error('Error getting all client profiles:', error);
            
            // Fallback to legacy system
            return this._getLegacyClientProfiles();
        }
    },
    
    // Helper: Save profile to legacy file system for backward compatibility
    _saveLegacyProfile(profileData, username) {
        try {
            const dataClientDir = path.join(__dirname, 'data_client');
            if (!fs.existsSync(dataClientDir)) {
                fs.mkdirSync(dataClientDir, { recursive: true });
            }
            
            const userProfilePath = path.join(dataClientDir, `${username}_profile.json`);
            fs.writeFileSync(userProfilePath, JSON.stringify(profileData, null, 2));
        } catch (error) {
            console.error('Error saving legacy profile:', error);
        }
    },
    
    // Helper: Get profiles from legacy system
    _getLegacyClientProfiles() {
        try {
            const dataClientDir = path.join(__dirname, 'data_client');
            if (!fs.existsSync(dataClientDir)) {
                return [];
            }
            
            const profileFiles = fs.readdirSync(dataClientDir)
                .filter(file => file.endsWith('_profile.json'));
            
            return profileFiles.map(file => {
                try {
                    const filePath = path.join(dataClientDir, file);
                    const clientId = file.split('_')[0];
                    const profileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    
                    // Add client ID
                    profileData.clientId = clientId;
                    
                    return profileData;
                } catch (error) {
                    console.error(`Error reading profile file ${file}:`, error);
                    return null;
                }
            }).filter(profile => profile !== null);
        } catch (error) {
            console.error('Error reading legacy client profiles:', error);
            return [];
        }
    },
    
    // Check if profile is complete
    isProfileComplete(username) {
        const profile = this.getUserProfile(username);
        
        if (!profile) {
            return false;
        }
        
        const requiredFields = [
            'firstName', 'lastName', 'email', 'phone', 
            'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
        ];
        
        return requiredFields.every(field => 
            profile[field] && profile[field].trim() !== ''
        );
    }
};

module.exports = userService;