import { fetchUserProfile, saveUserProfile } from '../core/api.js';
import { showNotification } from '../../utils/notification.js';
import { 
    isValidEmail, 
    isValidPhone, 
    isValidZipCode, 
    cleanNumericInput 
} from '../../utils/validation.js';

/**
 * Initialise le gestionnaire de profil
 */
export function initProfileManager() {
    console.log('Profile manager initialized');
    setupProfileForm();
}

/**
 * Configuration complète du formulaire de profil
 */
function setupProfileForm() {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) {
        console.error('Profile form not found');
        return;
    }

    // Charger les données du profil au chargement
    loadUserProfile();

    // Configuration des validations en temps réel
    setupRealtimeValidation(profileForm);

    // Gestion de la soumission du formulaire
    profileForm.addEventListener('submit', handleProfileSubmit);
}

/**
 * Charge les données du profil utilisateur
 */
async function loadUserProfile() {
    try {
        const profileForm = document.getElementById('profileForm');
        const formFields = profileForm.querySelectorAll('input');
        
        // Désactiver les champs pendant le chargement
        formFields.forEach(field => {
            field.disabled = true;
            field.value = 'Chargement...';
        });

        // Afficher un indicateur de chargement
        showLoadingIndicator(profileForm);

        // Récupérer les données du profil
        const profileData = await fetchUserProfile();
        
        // Masquer l'indicateur de chargement
        hideLoadingIndicator(profileForm);

        // Vérifier si des données sont disponibles
        if (!profileData || Object.keys(profileData).length === 0) {
            showNotification('Veuillez compléter vos informations de profil', 'info');
            return;
        }

        // Remplir le formulaire
        fillProfileForm(profileData);

        // Réactiver les champs
        formFields.forEach(field => {
            field.disabled = false;
        });

        showNotification('Profil chargé avec succès', 'success');

    } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
        showNotification('Impossible de charger le profil. Veuillez réessayer.', 'error');
        resetFormFields();
    }
}

/**
 * Affiche un indicateur de chargement
 * @param {HTMLElement} profileForm - Formulaire de profil
 */
function showLoadingIndicator(profileForm) {
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'profile-loading-message';
    loadingMessage.className = 'loading-container';
    loadingMessage.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Chargement de vos données...</p>
    `;
    profileForm.parentNode.insertBefore(loadingMessage, profileForm);
}

/**
 * Masque l'indicateur de chargement
 * @param {HTMLElement} profileForm - Formulaire de profil
 */
function hideLoadingIndicator(profileForm) {
    const messageElement = document.getElementById('profile-loading-message');
    if (messageElement) {
        messageElement.remove();
    }
}

/**
 * Remplit le formulaire avec les données du profil
 * @param {Object} profileData - Données du profil
 */
function fillProfileForm(profileData) {
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

    // Tableau des variantes possibles pour chaque champ
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

    // Fonction pour trouver la valeur d'un champ
    function findFieldValue(fieldName) {
        const possibleNames = fieldMappings[fieldName] || [fieldName];
        
        for (const name of possibleNames) {
            const value = profileData[name] || profileData[name.toLowerCase()];
            if (value !== undefined && value !== null) {
                return value;
            }
        }
        
        return '';
    }

    // Remplir les champs
    for (const [fieldName, field] of Object.entries(fields)) {
        if (field) {
            const value = findFieldValue(fieldName);
            field.value = value;
        }
    }

    // Formatage spécial pour téléphone et code postal
    if (fields.phone) {
        fields.phone.value = cleanNumericInput(fields.phone.value);
    }
    if (fields.shopZipCode) {
        fields.shopZipCode.value = cleanNumericInput(fields.shopZipCode.value);
    }
}

/**
 * Configuration des validations en temps réel
 * @param {HTMLFormElement} profileForm - Formulaire de profil
 */
function setupRealtimeValidation(profileForm) {
    const fields = {
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        shopZipCode: document.getElementById('shopZipCode')
    };

    // Validation de l'email
    if (fields.email) {
        fields.email.addEventListener('blur', () => validateEmailField(fields.email));
    }

    // Validation du téléphone
    if (fields.phone) {
        fields.phone.addEventListener('input', () => {
            fields.phone.value = cleanNumericInput(fields.phone.value);
        });
        fields.phone.addEventListener('blur', () => validatePhoneField(fields.phone));
    }

    // Validation du code postal
    if (fields.shopZipCode) {
        fields.shopZipCode.addEventListener('input', () => {
            fields.shopZipCode.value = cleanNumericInput(fields.shopZipCode.value);
        });
        fields.shopZipCode.addEventListener('blur', () => validateZipCodeField(fields.shopZipCode));
    }

    // Retirer les erreurs lors de la saisie
    profileForm.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
            removeErrorMessage(input);
        });
    });
}

/**
 * Validation du champ email
 * @param {HTMLInputElement} emailField - Champ email
 * @returns {boolean} Validité du champ
 */
function validateEmailField(emailField) {
    if (emailField.value && !isValidEmail(emailField.value)) {
        emailField.classList.add('input-error');
        showErrorMessage(emailField, 'Veuillez saisir une adresse email valide');
        return false;
    }
    emailField.classList.remove('input-error');
    removeErrorMessage(emailField);
    return true;
}

/**
 * Validation du champ téléphone
 * @param {HTMLInputElement} phoneField - Champ téléphone
 * @returns {boolean} Validité du champ
 */
function validatePhoneField(phoneField) {
    if (phoneField.value && !isValidPhone(phoneField.value)) {
        phoneField.classList.add('input-error');
        showErrorMessage(phoneField, 'Veuillez saisir un numéro de téléphone valide (10 chiffres)');
        return false;
    }
    phoneField.classList.remove('input-error');
    removeErrorMessage(phoneField);
    return true;
}

/**
 * Validation du champ code postal
 * @param {HTMLInputElement} zipCodeField - Champ code postal
 * @returns {boolean} Validité du champ
 */
function validateZipCodeField(zipCodeField) {
    if (zipCodeField.value && !isValidZipCode(zipCodeField.value)) {
        zipCodeField.classList.add('input-error');
        showErrorMessage(zipCodeField, 'Veuillez saisir un code postal valide');
        return false;
    }
    zipCodeField.classList.remove('input-error');
    removeErrorMessage(zipCodeField);
    return true;
}

/**
 * Gère la soumission du formulaire de profil
 * @param {Event} event - Événement de soumission
 */
async function handleProfileSubmit(event) {
    event.preventDefault();

    // Vérifier la validité de tous les champs
    if (!validateForm()) {
        return;
    }

    // Désactiver le bouton de soumission
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Enregistrement...';
    }

    try {
        // Collecter les données du formulaire
        const profileData = collectProfileData();

        // Sauvegarder le profil
        const result = await saveUserProfile(profileData);

        if (result.success) {
            showNotification('Profil enregistré avec succès', 'success');
            
            // Redirection après sauvegarde
            setTimeout(() => {
                window.location.href = '/pages/catalog.html';
            }, 1500);
        } else {
            showNotification(result.message || 'Erreur lors de l\'enregistrement', 'error');
        }
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du profil:', error);
        showNotification('Impossible d\'enregistrer le profil. Veuillez réessayer.', 'error');
    } finally {
        // Réactiver le bouton de soumission
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Enregistrer';
        }
    }
}

/**
 * Collecte les données du formulaire
 * @returns {Object} Données du profil
 */
function collectProfileData() {
    return {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        fullName: `${document.getElementById('firstName').value.trim()} ${document.getElementById('lastName').value.trim()}`,
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        shopName: document.getElementById('shopName').value.trim(),
        shopAddress: document.getElementById('shopAddress').value.trim(),
        shopCity: document.getElementById('shopCity').value.trim(),
        shopZipCode: document.getElementById('shopZipCode').value.trim(),
        lastUpdated: new Date().toISOString()
    };
}

/**
 * Valide l'ensemble du formulaire
 * @returns {boolean} Validité du formulaire
 */
function validateForm() {
    const requiredFields = [
        'firstName', 'lastName', 'email', 'phone', 
        'shopName', 'shopAddress', 'shopCity', 'shopZipCode'
    ];

    let isValid = true;

    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            field.classList.add('input-error');
            showErrorMessage(field, 'Ce champ est requis');
            isValid = false;
        } else {
            // Validations spécifiques
            switch(fieldId) {
                case 'email':
                    isValid = validateEmailField(field) && isValid;
                    break;
                case 'phone':
                    isValid = validatePhoneField(field) && isValid;
                    break;
                case 'shopZipCode':
                    isValid = validateZipCodeField(field) && isValid;
                    break;
            }
        }
    });

    return isValid;
}

/**
 * Affiche un message d'erreur pour un champ
 * @param {HTMLElement} field - Champ concerné
 * @param {string} message - Message d'erreur
 */
function showErrorMessage(field, message) {
    removeErrorMessage(field);
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message visible';
    errorElement.textContent = message;
    
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
 * Réinitialise les champs du formulaire
 */
function resetFormFields() {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        const formFields = profileForm.querySelectorAll('input');
        formFields.forEach(field => {
            field.disabled = false;
            field.value = '';
            field.classList.remove('input-error');
            removeErrorMessage(field);
        });
    }
}

// Initialisation au chargement du document
document.addEventListener('DOMContentLoaded', initProfileManager);

// Exporter les fonctions publiques
export { 
    initProfileManager, 
    loadUserProfile, 
    handleProfileSubmit 
};