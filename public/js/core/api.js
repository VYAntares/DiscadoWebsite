/**
 * API Core Module
 * Centralisation de tous les appels API
 * Toutes les requêtes au serveur passent par ce module
 */

import { showNotification } from '../utils/notification.js';

// Configuration par défaut pour les requêtes
const API_CONFIG = {
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'same-origin' // Pour envoyer les cookies de session
};

/**
 * Fonction helper pour gérer les erreurs d'API
 * @param {Response} response - La réponse de fetch
 * @returns {Promise} - Retourne la réponse JSON ou rejette avec une erreur
 */
async function handleApiResponse(response) {
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.message || errorData.error || `Error: ${response.status}`;
    } catch (e) {
      errorMessage = `Error: ${response.status}`;
    }
    
    showNotification(errorMessage, 'error');
    throw new Error(errorMessage);
  }
  
  return response.json();
}

/**
 * Récupère tous les produits du catalogue
 * @returns {Promise<Array>} Liste des produits
 */
export async function fetchProducts() {
  try {
    const response = await fetch('/api/products', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

/**
 * Récupère les détails d'un produit
 * @param {string} productId - ID du produit
 * @returns {Promise<Object>} Détails du produit
 */
export async function fetchProductDetails(productId) {
  try {
    const response = await fetch(`/api/products/${productId}`, API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error(`Error fetching product details for ${productId}:`, error);
    throw error;
  }
}

/**
 * Enregistre une commande
 * @param {Object} orderData - Données de la commande
 * @returns {Promise<Object>} Résultat de l'enregistrement
 */
export async function saveOrder(orderData) {
  try {
    const response = await fetch('/api/save-order', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify(orderData)
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      showNotification('Order placed successfully!', 'success');
    }
    
    return result;
  } catch (error) {
    console.error('Error saving order:', error);
    throw error;
  }
}

/**
 * Récupère les commandes de l'utilisateur
 * @returns {Promise<Array>} Liste des commandes
 */
export async function fetchUserOrders() {
  try {
    const response = await fetch('/api/user-orders', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    throw error;
  }
}

/**
 * Récupère le profil de l'utilisateur
 * @returns {Promise<Object>} Profil utilisateur
 */
export async function fetchUserProfile() {
  try {
    const response = await fetch('/api/user-profile', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Sauvegarde le profil utilisateur
 * @param {Object} profileData - Données du profil
 * @returns {Promise<Object>} Résultat de la sauvegarde
 */
export async function saveUserProfile(profileData) {
  try {
    const response = await fetch('/api/save-profile', {
      ...API_CONFIG,
      method: 'POST',
      body: JSON.stringify(profileData)
    });
    
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
}

/**
 * Génère un lien pour télécharger une facture
 * @param {string} orderId - ID de la commande
 * @returns {string} URL de téléchargement
 */
export function getInvoiceDownloadLink(orderId) {
  return `/api/download-invoice/${orderId}`;
}

/**
 * Vérifie l'état de l'authentification
 * @returns {Promise<Object>} Informations sur l'utilisateur connecté
 */
export async function checkAuthentication() {
  try {
    const response = await fetch('/api/check-auth', API_CONFIG);
    return handleApiResponse(response);
  } catch (error) {
    console.error('Error checking authentication:', error);
    throw error;
  }
}