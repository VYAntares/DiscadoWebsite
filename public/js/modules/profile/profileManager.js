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

import React, { useState, useEffect } from 'react';

const ProfileDebugger = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mappedFields, setMappedFields] = useState({});

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const response = await fetch('/api/user-profile');
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        setProfileData(data);
        
        // Map the profile data to expected form fields
        const fieldMapping = {
          firstName: findValue(data, ['firstName', 'first_name', 'firstname', 'prénom']),
          lastName: findValue(data, ['lastName', 'last_name', 'lastname', 'nom']),
          email: findValue(data, ['email', 'courriel', 'mail']),
          phone: findValue(data, ['phone', 'phoneNumber', 'téléphone', 'telephone']),
          shopName: findValue(data, ['shopName', 'shop_name', 'shopname', 'nom_boutique', 'boutique']),
          shopAddress: findValue(data, ['shopAddress', 'shop_address', 'shopaddress', 'address', 'adresse']),
          shopCity: findValue(data, ['shopCity', 'shop_city', 'shopcity', 'city', 'ville']),
          shopZipCode: findValue(data, ['shopZipCode', 'shop_zip_code', 'shopzipcode', 'zipCode', 'zip', 'postalCode', 'postal_code', 'code_postal'])
        };
        
        setMappedFields(fieldMapping);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProfile();
  }, []);
  
  // Helper function to find value from multiple possible keys
  function findValue(data, possibleKeys) {
    if (!data) return '';
    
    for (const key of possibleKeys) {
      if (data[key] !== undefined && data[key] !== null) {
        return data[key];
      }
      // Try lowercase version too
      if (data[key.toLowerCase()] !== undefined && data[key.toLowerCase()] !== null) {
        return data[key.toLowerCase()];
      }
    }
    return '';
  }

  if (loading) {
    return (
      <div className="bg-white shadow-md rounded p-6 mb-4">
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
          <span className="ml-2">Loading profile data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow-md rounded p-6 mb-4">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
        <p>Check your network tab for API errors or try reloading the page.</p>
      </div>
    );
  }

  if (!profileData || Object.keys(profileData).length === 0) {
    return (
      <div className="bg-white shadow-md rounded p-6 mb-4">
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
          <p className="font-bold">No profile data found</p>
          <p>Your user profile appears to be empty in the database.</p>
        </div>
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Troubleshooting Steps:</h3>
          <ol className="list-decimal list-inside space-y-2 pl-4">
            <li>Check if your account is properly registered in the database</li>
            <li>Verify that the <code>/api/user-profile</code> endpoint works correctly</li>
            <li>Try logging out and logging back in</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded p-6">
      <h2 className="text-xl font-bold mb-4">Profile Data Debugger</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h3 className="font-semibold text-lg mb-2">Raw Profile Data</h3>
          <div className="bg-gray-50 p-4 rounded overflow-auto max-h-96">
            <pre className="text-xs whitespace-pre-wrap">
              {JSON.stringify(profileData, null, 2)}
            </pre>
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold text-lg mb-2">Mapped Form Fields</h3>
          <div className="bg-gray-50 p-4 rounded overflow-auto max-h-96">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-sm font-medium text-gray-500">Form Field</th>
                  <th className="text-left text-sm font-medium text-gray-500">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(mappedFields).map(([field, value]) => (
                  <tr key={field} className="border-t">
                    <td className="py-2 text-sm font-medium">{field}</td>
                    <td className="py-2 text-sm">{value || '(empty)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div className="bg-blue-50 p-4 rounded border border-blue-200">
        <h3 className="font-semibold mb-2">Solution</h3>
        <p>If you see data in the "Raw Profile Data" section but not in the "Mapped Form Fields" section, the field names may be mismatched.</p>
        <p className="mt-2">Try updating the field mapping in <code>profileManager.js</code> to match the actual data structure.</p>
      </div>
      
      <div className="mt-6">
        <h3 className="font-semibold text-lg mb-2">Profile Form Fix</h3>
        <p>Copy and paste this code into your profileManager.js file to replace the existing fillProfileForm function:</p>
        <div className="bg-gray-50 p-4 rounded overflow-auto mt-2">
          <pre className="text-xs whitespace-pre-wrap">
{`function fillProfileForm(profileData) {
  if (!profileData) return;
  
  console.log('Filling profile form with data:', JSON.stringify(profileData, null, 2));
  
  // Helper function to find value from multiple possible keys
  function findFieldValue(fieldName, possibleKeys) {
    if (!possibleKeys) return '';
    
    for (const key of possibleKeys) {
      if (profileData[key] !== undefined && profileData[key] !== null) {
        return profileData[key];
      }
      // Try lowercase version too
      if (profileData[key.toLowerCase()] !== undefined && profileData[key.toLowerCase()] !== null) {
        return profileData[key.toLowerCase()];
      }
    }
    return '';
  }
  
  // Define field mappings - all possible keys for each field
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
  
  // Get all fields
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
  
  // Loop through each field and set its value
  for (const [fieldName, field] of Object.entries(fields)) {
    if (field) {
      const value = findFieldValue(fieldName, fieldMappings[fieldName]);
      field.value = value;
      console.log(\`Set \${fieldName} to "\${value}"\`);
    }
  }
  
  // Handle special case for fullName
  if (profileData.fullName && (!fields.firstName.value || !fields.lastName.value)) {
    const nameParts = profileData.fullName.split(' ');
    if (nameParts.length > 1) {
      if (!fields.firstName.value && fields.firstName) {
        fields.firstName.value = nameParts[0] || '';
      }
      if (!fields.lastName.value && fields.lastName) {
        fields.lastName.value = nameParts.slice(1).join(' ') || '';
      }
    }
  }
  
  // Special formatting for phone (digits only)
  if (fields.phone && fields.phone.value) {
    fields.phone.value = fields.phone.value.replace(/[^0-9]/g, '');
  }
  
  // Special formatting for zipCode (digits only)
  if (fields.shopZipCode && fields.shopZipCode.value) {
    fields.shopZipCode.value = fields.shopZipCode.value.replace(/[^0-9]/g, '');
  }
}`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ProfileDebugger;

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
    // Disable save button
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }
    
    // Get form data
    const profileData = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        fullName: document.getElementById('firstName').value.trim() + ' ' + document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        shopName: document.getElementById('shopName').value.trim(),
        shopAddress: document.getElementById('shopAddress').value.trim(),
        shopCity: document.getElementById('shopCity').value.trim(),
        shopZipCode: document.getElementById('shopZipCode').value.trim(),
        address: document.getElementById('shopAddress').value.trim(),
        city: document.getElementById('shopCity').value.trim(),
        postalCode: document.getElementById('shopZipCode').value.trim(),
        lastUpdated: new Date().toISOString()
    };
    
    // Log data being saved
    console.log('Profile data to save:', profileData);
    
    try {
        // Send data to server
        const result = await saveUserProfile(profileData);
        console.log('Save profile response:', result);
        
        if (result.success) {
            showNotification('Profile saved successfully!', 'success');
            
            // Always redirect to catalog after successful save
            showNotification('Redirecting to catalog...', 'info');
            
            setTimeout(() => {
                window.location.href = '/pages/catalog.html';
            }, 1500);
        } else {
            showNotification(result.message || 'Error saving profile', 'error');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification('Error saving profile. Please try again or contact support.', 'error');
    } finally {
        // Re-enable save button
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