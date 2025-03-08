/**
 * Création d'un nouveau client
 * Ce module gère la création de nouveaux comptes clients
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Modal from '../../utils/modal.js';
import * as ClientList from './clientList.js';

// Références DOM
let createClientModal;
let createClientForm;
let usernameField;
let passwordField;

/**
 * Affiche la modale de création de client
 */
function showCreateClientModal() {
    // Obtenir les références DOM
    createClientModal = document.getElementById('createClientModal');
    createClientForm = document.getElementById('createClientForm');
    usernameField = document.getElementById('newUsername');
    passwordField = document.getElementById('newPassword');
    
    if (!createClientModal || !createClientForm) {
        console.error("Modal de création de client non trouvée");
        return;
    }
    
    // Réinitialiser le formulaire
    createClientForm.reset();
    
    // Afficher la modale
    Modal.showModal(createClientModal);
    
    // Focus sur le premier champ
    if (usernameField) {
        usernameField.focus();
    }
    
    // Configurer les événements du formulaire
    setupFormEvents();
}

/**
 * Configure les événements du formulaire
 */
function setupFormEvents() {
    // Évènement de soumission
    createClientForm.addEventListener('submit', handleFormSubmit);
    
    // Bouton Annuler
    const cancelBtn = createClientModal.querySelector('.cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            Modal.hideModal(createClientModal);
        });
    }
    
    // Fermer la modale
    const closeBtn = createClientModal.querySelector('.close-create-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            Modal.hideModal(createClientModal);
        });
    }
    
    // Validation en temps réel
    usernameField.addEventListener('input', validateUsername);
    passwordField.addEventListener('input', validatePassword);
}

/**
 * Valide le nom d'utilisateur
 * @returns {boolean} Validité du nom d'utilisateur
 */
function validateUsername() {
    const username = usernameField.value.trim();
    
    // Vérifier la longueur minimale (3 caractères)
    if (username.length < 3) {
        showFieldError(usernameField, 'Le nom d\'utilisateur doit contenir au moins 3 caractères');
        return false;
    }
    
    // Vérifier que le nom d'utilisateur contient uniquement des caractères alphanumériques et des underscores
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showFieldError(usernameField, 'Le nom d\'utilisateur ne peut contenir que des lettres, des chiffres et des underscores');
        return false;
    }
    
    // Valide
    clearFieldError(usernameField);
    return true;
}

/**
 * Valide le mot de passe
 * @returns {boolean} Validité du mot de passe
 */
function validatePassword() {
    const password = passwordField.value;
    
    // Vérifier la longueur minimale (6 caractères)
    if (password.length < 6) {
        showFieldError(passwordField, 'Le mot de passe doit contenir au moins 6 caractères');
        return false;
    }
    
    // Valide
    clearFieldError(passwordField);
    return true;
}

/**
 * Affiche une erreur pour un champ
 * @param {HTMLElement} field - Champ concerné
 * @param {string} message - Message d'erreur
 */
function showFieldError(field, message) {
    // Supprimer une éventuelle erreur précédente
    clearFieldError(field);
    
    // Ajouter la classe d'erreur au champ
    field.classList.add('error-field');
    
    // Créer le message d'erreur
    const errorElement = document.createElement('div');
    errorElement.className = 'form-error';
    errorElement.textContent = message;
    
    // Insérer le message après le champ
    field.parentNode.appendChild(errorElement);
}

/**
 * Supprime l'erreur d'un champ
 * @param {HTMLElement} field - Champ concerné
 */
function clearFieldError(field) {
    // Supprimer la classe d'erreur
    field.classList.remove('error-field');
    
    // Supprimer les messages d'erreur existants
    const errorElement = field.parentNode.querySelector('.form-error');
    if (errorElement) {
        errorElement.remove();
    }
}

/**
 * Gère la soumission du formulaire
 * @param {Event} e - Événement de soumission
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Valider les champs obligatoires
    if (!validateUsername() || !validatePassword()) {
        return;
    }
    
    // Récupérer les valeurs du formulaire
    const username = usernameField.value.trim();
    const password = passwordField.value;
    
    // Récupérer les données du profil (facultatives)
    const profileData = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        shopName: document.getElementById('shopName').value.trim(),
        shopAddress: document.getElementById('shopAddress').value.trim(),
        shopCity: document.getElementById('shopCity').value.trim(),
        shopZipCode: document.getElementById('shopZipCode').value.trim(),
        lastUpdated: new Date().toISOString()
    };
    
    // Désactiver le bouton de soumission
    const submitBtn = document.querySelector('.submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Création en cours...';
    }
    
    try {
        // Envoyer les données au serveur
        const result = await API.createNewClient({
            username,
            password,
            profileData
        });
        
        if (result.success) {
            // Afficher le message de succès
            Notification.showNotification(`Client ${username} créé avec succès`, 'success');
            
            // Fermer la modale et réinitialiser le formulaire
            Modal.hideModal(createClientModal);
            createClientForm.reset();
            
            // Rafraîchir la liste des clients
            ClientList.refreshClientList();
        } else {
            // Afficher l'erreur
            Notification.showNotification('Erreur : ' + (result.message || 'Veuillez réessayer'), 'error');
            
            // Réactiver le bouton
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Créer le client';
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
        Notification.showNotification('Erreur lors de la création du client', 'error');
        
        // Réactiver le bouton
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Créer le client';
        }
    }
}

/**
 * Crée un nouveau client
 * @param {Object} formData - Données du formulaire
 * @returns {Promise<Object>} Résultat de la création
 */
async function createClient(formData) {
    try {
        const result = await API.createNewClient(formData);
        return result;
    } catch (error) {
        console.error('Erreur lors de la création du client:', error);
        throw error;
    }
}

/**
 * Valide le formulaire client complet
 * @returns {boolean} Validité du formulaire
 */
function validateClientForm() {
    // Valider tous les champs requis
    return validateUsername() && validatePassword();
}

// Puis exporter normalement:
export {
    showCreateClientModal,
    validateClientForm,
    createClient
};