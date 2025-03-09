/**
 * Module de gestion du profil utilisateur
 * Gère l'affichage et la modification des données de profil
 */

import { fetchUserProfile, saveUserProfile } from '../../core/api.js';
import { showNotification } from '../../utils/notification.js';
import { 
    isValidEmail, 
    isValidPhone, 
    isValidZipCode, 
    validateFormWithMessages, 
    cleanNumericInput 
} from '../../utils/validation.js';

/**
 * Initialise le gestionnaire de profil
 */
export function initProfileManager() {
    console.log('Profile manager initialized');
    
    // Initialiser les validations du formulaire
    setupFormValidation();
    
    // Charger les données du profil
    loadUserProfile();
}

/**
 * Charge les données du profil utilisateur
 */
async function loadUserProfile() {
    try {
        // Récupérer le formulaire
        const profileForm = document.getElementById('profileForm');
        if (!profileForm) {
            console.error('Profile form not found');
            return;
        }
        
        // Afficher l'état de chargement
        const formFields = profileForm.querySelectorAll('input');
        formFields.forEach(field => {
            field.disabled = true;
            field.value = 'Loading...';
        });
        
        // Ajouter un message visible
        const loadingMessage = document.createElement('div');
        loadingMessage.id = 'profile-loading-message';
        loadingMessage.className = 'loading-container';
        loadingMessage.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Loading your profile data...</p>
        `;
        profileForm.parentNode.insertBefore(loadingMessage, profileForm);
        
        // Récupérer les données du profil - attendre un peu pour assurer que l'UI est mise à jour
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Récupérer les données du profil depuis l'API
        const response = await fetch('/api/user-profile');
        
        // Supprimer le message de chargement
        const messageElement = document.getElementById('profile-loading-message');
        if (messageElement) {
            messageElement.remove();
        }
        
        if (!response.ok) {
            throw new Error(`Failed to load profile: ${response.status} ${response.statusText}`);
        }
        
        // Vérifier le type de contenu
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.warn('Response is not JSON:', contentType);
            showNotification('Invalid response format from server', 'error');
            
            // Réactiver les champs
            formFields.forEach(field => {
                field.disabled = false;
                field.value = '';
            });
            return;
        }
        
        const profileData = await response.json();
        console.log('Profile data loaded:', profileData);
        
        // Vérifier si des données ont été retournées
        if (!profileData || Object.keys(profileData).length === 0) {
            console.warn('No profile data returned from API');
            showNotification('Please complete your profile information.', 'info');
            
            // Réactiver les champs pour permettre la saisie
            formFields.forEach(field => {
                field.disabled = false;
                field.value = '';
            });
            return;
        }
        
        // Remplir les champs du formulaire
        fillProfileForm(profileData);
        
        // Réactiver les champs
        formFields.forEach(field => {
            field.disabled = false;
        });
        
        showNotification('Profile loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Error loading profile. Please try again or contact support.', 'error');
        
        // Réactiver les champs
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            const formFields = profileForm.querySelectorAll('input');
            formFields.forEach(field => {
                field.disabled = false;
                field.value = '';
            });
            
            // Supprimer le message de chargement s'il existe encore
            const messageElement = document.getElementById('profile-loading-message');
            if (messageElement) {
                messageElement.remove();
            }
        }
    }
}

/**
 * Remplit le formulaire avec les données du profil
 * @param {Object} profileData - Données du profil
 */
function fillProfileForm(profileData) {
    if (!profileData) return;
    
    // Journal de débogage
    console.log('Filling profile form with data:', JSON.stringify(profileData, null, 2));
    
    // Vérifier toutes les clés possibles
    const allKeys = Object.keys(profileData);
    console.log('All profile data keys:', allKeys);
    
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
    
    // Récupérer tous les champs et les nettoyer
    const fields = {
        firstName: document.getElementById('firstName'),
        lastName: document.getElementById('lastName'),
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        shopName: document.getElementById('shopName'),
        shopAddress: document.getElementById('shopAddress'),
        shopCity: document.getElementById('shopCity'),
        shopZipCode: document.getElementById('shopZipCode')
    };
    
    // Vérifier si les champs existent
    console.log('Form fields found:', Object.entries(fields).reduce((acc, [key, field]) => {
        acc[key] = !!field;
        return acc;
    }, {}));
    
    // Mapper toutes les possibilités de noms de champs pour plus de robustesse
    const fieldMappings = {
        firstName: ['firstName', 'first_name', 'firstname', 'prénom'],
        lastName: ['lastName', 'last_name', 'lastname', 'nom'],
        email: ['email', 'courriel', 'mail'],
        phone: ['phone', 'phoneNumber', 'téléphone', 'telephone'],
        shopName: ['shopName', 'shop_name', 'shopname', 'nom_boutique', 'boutique'],
        shopAddress: ['shopAddress', 'shop_address', 'shopaddress', 'address', 'adresse'],
        shopCity: ['shopCity', 'shop_city', 'shopcity', 'city', 'ville'],
        shopZipCode: ['shopZipCode', 'shop_zip_code', 'shopzipcode', 'zipCode', 'zip', 'postalCode', 'postal_code', 'code_postal']
    };
    
    // Fonction pour trouver la valeur d'un champ avec toutes les variantes possibles
    function findFieldValue(fieldName) {
        const possibleNames = fieldMappings[fieldName] || [fieldName];
        
        for (const name of possibleNames) {
            if (profileData[name] !== undefined && profileData[name] !== null) {
                return profileData[name];
            }
            
            // Essayer aussi en minuscules
            if (profileData[name.toLowerCase()] !== undefined && profileData[name.toLowerCase()] !== null) {
                return profileData[name.toLowerCase()];
            }
        }
        
        return '';
    }
    
    // Assigner les valeurs aux champs
    for (const [fieldName, field] of Object.entries(fields)) {
        if (field) {
            const value = findFieldValue(fieldName);
            field.value = value;
            console.log(`Set ${fieldName} to "${value}"`);
        }
    }
    
    // Formatage spécial du téléphone (pour s'assurer qu'il n'y a que des chiffres)
    if (fields.phone && fields.phone.value) {
        fields.phone.value = cleanNumericInput(fields.phone.value);
    }
    
    // Formatage spécial du code postal (pour s'assurer qu'il n'y a que des chiffres)
    if (fields.shopZipCode && fields.shopZipCode.value) {
        fields.shopZipCode.value = cleanNumericInput(fields.shopZipCode.value);
    }
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
        phone: 'Please enter a valid phone number (10 digits only, e.g. 0780123456)',
        shopName: 'Please enter your shop name',
        shopAddress: 'Please enter your shop address',
        shopCity: 'Please enter your shop city',
        shopZipCode: 'Please enter your shop zip code (numbers only)'
    };
    
    // Ajouter les validations en temps réel pour certains champs
    setupRealtimeValidation();
    
    // Gestion de la soumission du formulaire
    profileForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // Valider le formulaire avec notre fonction personnalisée
        if (validateForm()) {
            saveProfile();
        }
    });
}

/**
 * Valide tout le formulaire
 * @returns {boolean} True si le formulaire est valide
 */
function validateForm() {
    const requiredFields = [
        'firstName', 'lastName', 'email', 'phone', 
        'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
    ];
    
    let isValid = true;
    
    // Valider chaque champ requis
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            field.classList.add('input-error');
            showErrorMessage(field, `This field is required`);
            isValid = false;
        } else {
            // Validation spécifique pour certains champs
            if (fieldId === 'email' && !isValidEmail(field.value)) {
                field.classList.add('input-error');
                showErrorMessage(field, 'Please enter a valid email address');
                isValid = false;
            } else if (fieldId === 'phone' && !isValidPhone(field.value)) {
                field.classList.add('input-error');
                showErrorMessage(field, 'Please enter a valid phone number (10 digits only)');
                isValid = false;
            } else if (fieldId === 'shopZipCode' && !isValidZipCode(field.value)) {
                field.classList.add('input-error');
                showErrorMessage(field, 'Please enter a valid zip code (numbers only)');
                isValid = false;
            } else {
                field.classList.remove('input-error');
                removeErrorMessage(field);
            }
        }
    });
    
    return isValid;
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
    
    // Validation du téléphone (uniquement des chiffres)
    const phoneField = document.getElementById('phone');
    if (phoneField) {
        // Forcer les chiffres uniquement pendant la saisie
        phoneField.addEventListener('input', function() {
            this.value = cleanNumericInput(this.value);
        });
        
        // Validation complète à la perte de focus
        phoneField.addEventListener('blur', function() {
            if (this.value && !isValidPhone(this.value)) {
                this.classList.add('input-error');
                showErrorMessage(this, 'Please enter a valid phone number (10 digits only, e.g. 0780123456)');
            } else {
                this.classList.remove('input-error');
                removeErrorMessage(this);
            }
        });
    }
    
    // Validation du code postal (uniquement des chiffres)
    const zipCodeField = document.getElementById('shopZipCode');
    if (zipCodeField) {
        // Forcer les chiffres uniquement pendant la saisie
        zipCodeField.addEventListener('input', function() {
            this.value = cleanNumericInput(this.value);
        });
        
        // Validation complète à la perte de focus
        zipCodeField.addEventListener('blur', function() {
            if (this.value && !isValidZipCode(this.value)) {
                this.classList.add('input-error');
                showErrorMessage(this, 'Please enter a valid zip code (numbers only)');
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
        showNotification('Error saving profile. Please try again or contact support.', 'error');
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
}