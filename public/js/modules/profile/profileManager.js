/**
 * Module de gestion du profil utilisateur
 * Gère l'affichage et la modification des données de profil
 */

import { fetchUserProfile, saveUserProfile } from '../../core/api.js';
import { showNotification } from '../../utils/notification.js';
import { isValidEmail, isValidPhone, validateFormWithMessages } from '../../utils/validation.js';

/**
 * Initialise le gestionnaire de profil
 */
export function initProfileManager() {
    console.log('Profile manager initialized');
    
    // Charger les données du profil
    loadUserProfile();
    
    // Initialiser les validations du formulaire
    setupFormValidation();
}

/**
 * Charge les données du profil utilisateur
 */
async function loadUserProfile() {
    try {
        // Récupérer le formulaire
        const profileForm = document.getElementById('profileForm');
        if (!profileForm) return;
        
        // Afficher l'état de chargement
        const formFields = profileForm.querySelectorAll('input');
        formFields.forEach(field => {
            field.disabled = true;
            field.value = 'Loading...';
        });
        
        // Récupérer les données du profil
        const profileData = await fetchUserProfile();
        console.log('Profile data loaded:', profileData);
        
        // Remplir les champs du formulaire
        fillProfileForm(profileData);
        
        // Réactiver les champs
        formFields.forEach(field => {
            field.disabled = false;
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Error loading profile data', 'error');
        
        // Réactiver les champs
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            const formFields = profileForm.querySelectorAll('input');
            formFields.forEach(field => {
                field.disabled = false;
                field.value = '';
            });
        }
    }
}

/**
 * Remplit le formulaire avec les données du profil
 * @param {Object} profileData - Données du profil
 */
function fillProfileForm(profileData) {
    if (!profileData) return;
    
    // Split fullName into firstName and lastName if needed
    if (profileData.fullName && (!profileData.firstName || !profileData.lastName)) {
        const nameParts = profileData.fullName.split(' ');
        if (nameParts.length > 1) {
            profileData.firstName = profileData.firstName || nameParts[0] || '';
            profileData.lastName = profileData.lastName || nameParts.slice(1).join(' ') || '';
        } else {
            profileData.firstName = profileData.firstName || profileData.fullName || '';
            profileData.lastName = profileData.lastName || '';
        }
    }
    
    // Remplir les champs d'informations personnelles
    document.getElementById('firstName').value = profileData.firstName || '';
    document.getElementById('lastName').value = profileData.lastName || '';
    document.getElementById('email').value = profileData.email || '';
    document.getElementById('phone').value = profileData.phone || '';
    
    // Remplir les champs d'informations de boutique
    document.getElementById('shopName').value = profileData.shopName || '';
    document.getElementById('shopAddress').value = profileData.shopAddress || profileData.address || '';
    document.getElementById('shopCity').value = profileData.shopCity || profileData.city || '';
    document.getElementById('shopZipCode').value = profileData.shopZipCode || profileData.postalCode || '';
}

/**
 * Configure les validations du formulaire
 */
function setupFormValidation() {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) return;
    
    // Messages d'erreur personnalisés pour la validation
    const customMessages = {
        firstName: 'Please enter your first name',
        lastName: 'Please enter your last name',
        email: 'Please enter a valid email address',
        phone: 'Please enter a valid phone number',
        shopName: 'Please enter your shop name',
        shopAddress: 'Please enter your shop address',
        shopCity: 'Please enter your shop city',
        shopZipCode: 'Please enter your shop zip code'
    };
    
    // Ajouter les validations en temps réel pour certains champs
    setupRealtimeValidation();
    
    // Gestion de la soumission du formulaire
    profileForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // Valider le formulaire
        if (validateFormWithMessages(this, customMessages)) {
            saveProfile();
        }
    });
}

/**
 * Configure les validations en temps réel
 */
function setupRealtimeValidation() {
    // Validation de l'email
    const emailField = document.getElementById('email');
    if (emailField) {
        emailField.addEventListener('blur', function() {
            if (this.value && !isValidEmail(this.value)) {
                this.classList.add('input-error');
                showErrorMessage(this, 'Please enter a valid email address');
            } else {
                this.classList.remove('input-error');
                removeErrorMessage(this);
            }
        });
    }
    
    // Validation du téléphone
    const phoneField = document.getElementById('phone');
    if (phoneField) {
        phoneField.addEventListener('blur', function() {
            if (this.value && !isValidPhone(this.value)) {
                this.classList.add('input-error');
                showErrorMessage(this, 'Please enter a valid phone number (e.g., 0781234567)');
            } else {
                this.classList.remove('input-error');
                removeErrorMessage(this);
            }
        });
    }
    
    // Retirer les erreurs quand l'utilisateur commence à taper
    const inputFields = document.querySelectorAll('#profileForm input');
    inputFields.forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('input-error');
            removeErrorMessage(this);
        });
    });
}

/**
 * Affiche un message d'erreur pour un champ
 * @param {HTMLElement} field - Champ concerné
 * @param {string} message - Message d'erreur
 */
function showErrorMessage(field, message) {
    // Supprimer les messages d'erreur existants
    removeErrorMessage(field);
    
    // Créer le message d'erreur
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message visible';
    errorElement.textContent = message;
    
    // Ajouter le message après le champ
    field.parentNode.appendChild(errorElement);
}

/**
 * Supprime le message d'erreur d'un champ
 * @param {HTMLElement} field - Champ concerné
 */
function removeErrorMessage(field) {
    const errorElement = field.parentNode.querySelector('.error-message');
    if (errorElement) {
        errorElement.remove();
    }
}

/**
 * Sauvegarde le profil utilisateur
 */
async function saveProfile() {
    // Désactiver le bouton de sauvegarde
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }
    
    // Récupérer les données du formulaire
    const profileData = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        // Keep fullName for backward compatibility
        fullName: document.getElementById('firstName').value.trim() + ' ' + document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        shopName: document.getElementById('shopName').value.trim(),
        shopAddress: document.getElementById('shopAddress').value.trim(),
        shopCity: document.getElementById('shopCity').value.trim(),
        shopZipCode: document.getElementById('shopZipCode').value.trim(),
        // Keep these fields for backward compatibility
        address: document.getElementById('shopAddress').value.trim(),
        city: document.getElementById('shopCity').value.trim(),
        postalCode: document.getElementById('shopZipCode').value.trim(),
        lastUpdated: new Date().toISOString()
    };
    
    // Check if profile is complete
    const isProfileComplete = checkProfileComplete(profileData);
    console.log('Profile data to save:', profileData);
    console.log('Is profile complete (client check):', isProfileComplete);
    
    try {
        // Envoyer les données au serveur
        const result = await saveUserProfile(profileData);
        console.log('Save profile response:', result);
        
        if (result.success) {
            showNotification('Profile saved successfully!', 'success');
            
            // Si le profil est complet, rediriger vers le catalogue
            // Vérifie à la fois la réponse du serveur et une vérification côté client
            if (result.isProfileComplete || isProfileComplete) {
                showNotification('Profile complete! Redirecting to catalog...', 'info');
                
                // Use a timeout to allow notifications to be seen
                setTimeout(() => {
                    window.location.href = '/pages/catalog.html';
                }, 1500);
            }
        } else {
            showNotification(result.message || 'Error saving profile', 'error');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification('Error saving profile', 'error');
    } finally {
        // Réactiver le bouton de sauvegarde
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Profile';
        }
    }
}

/**
 * Vérifie si tous les champs requis sont remplis (côté client)
 * @param {Object} profileData - Données du profil
 * @returns {boolean} True si le profil est complet
 */
function checkProfileComplete(profileData) {
    const requiredFields = [
        'firstName', 'lastName', 'email', 'phone', 
        'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
    ];
    
    return requiredFields.every(field => 
        profileData[field] && profileData[field].trim() !== ''
    );
}

/**
 * Exporte les fonctions publiques
 */
export {
    initProfileManager,
    loadUserProfile,
    saveProfile
};