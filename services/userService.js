// userService.js - Handle user and profile operations
const dbModule = require('./db');

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
            // Get profile from database
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
            
            return null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    },
    
    // Save user profile
    // Save user profile
    saveUserProfile(profileData, username) {
        try {
            // Debug log of incoming data
            console.log(`Saving profile for ${username}:`, JSON.stringify(profileData, null, 2));
            
            // Normaliser les données
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
            
            console.log(`Normalized data for ${username}:`, JSON.stringify(normalizedData, null, 2));
            
            // Vérifier si le profil existe déjà
            const existingProfile = dbModule.getUserProfile.get(username);
            console.log(`Existing profile for ${username}:`, existingProfile ? "Found" : "Not found");
            
            if (existingProfile) {
                // Mise à jour du profil existant
                console.log(`Updating existing profile for ${username}`);
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
                // Création d'un nouveau profil
                console.log(`Creating new profile for ${username}`);
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
            
            // Vérifier si le profil est complet après la sauvegarde
            const isComplete = this.isProfileComplete(username);
            console.log(`Profile saved for ${username}, complete: ${isComplete}`);
            
            // Vérifier la récupération du profil après sauvegarde pour confirmer
            const savedProfile = this.getUserProfile(username);
            console.log(`Retrieved profile after save:`, JSON.stringify(savedProfile, null, 2));
            
            return { 
                success: true,
                isProfileComplete: isComplete,
                shouldRedirect: true, // Forcer la redirection
                profile: savedProfile, // Inclure le profil dans la réponse
                message: 'Profil sauvegardé avec succès'
            };
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
        
        // Check if all required fields have valid values
        return requiredFields.every(field => 
            profile[field] && profile[field].trim() !== ''
        );
    }
};

module.exports = userService;