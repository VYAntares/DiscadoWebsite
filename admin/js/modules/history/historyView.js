/**
 * Visualisation détaillée d'une commande de l'historique
 * Ce module gère l'affichage des détails d'une commande traitée
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as Modal from '../../utils/modal.js';

// Références DOM
let orderModal;
let orderDetailsContent;

/**
 * Affiche les détails d'une commande
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID de l'utilisateur
 */
async function viewOrderDetails(orderId, userId) {
    // Obtenir les références DOM
    orderModal = document.getElementById('orderModal');
    orderDetailsContent = document.getElementById('orderModalContent');
    
    if (!orderModal || !orderDetailsContent) {
        console.error("Modal de détails de commande non trouvée");
        return;
    }
    
    // Afficher l'indicateur de chargement
    orderDetailsContent.innerHTML = `<div class="loading">Chargement des détails...</div>`;
    
    // Afficher la modale
    Modal.showModal(orderModal);
    
    try {
        // Récupérer les détails de la commande
        const orderDetails = await API.fetchOrderDetails(orderId, userId);
        
        // Afficher les détails de la commande
        displayOrderDetails(orderDetails);
    } catch (error) {
        console.error('Erreur lors du chargement des détails de la commande:', error);
        
        // Afficher un message d'erreur
        orderDetailsContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement des détails de la commande.</p>
            </div>
        `;
    }
}

/**
 * Affiche les détails d'une commande dans la modale
 * @param {Object} order - Détails de la commande
 */
function displayOrderDetails(order) {
    // Formater les dates pour l'affichage
    const orderDate = Formatter.formatDate(order.date);
    
    // Calculer le montant total uniquement pour les articles livrés
    const totalAmount = (order.deliveredItems || []).reduce((total, item) => {
        return total + (parseFloat(item.prix) * item.quantity);
    }, 0).toFixed(2);
    
    // Déterminer le statut de la commande
    let statusText = 'COMPLETED';
    let statusClass = 'status-completed';
    
    if (order.remainingItems && order.remainingItems.length > 0) {
        statusText = 'PARTIALLY SHIPPED';
        statusClass = 'status-partial';
    }
    
    // Construire le contenu HTML des détails de la commande
    let detailsHTML = `
        <div class="order-header">
            <div>
                <div class="order-number">Commande #${order.orderId.split('_').pop()}</div>
                <div class="order-date">${orderDate.split(',')[0]}</div>
            </div>
            <div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
        </div>

        <div class="order-items-section">
            <table class="items-table">
                <thead>
                    <tr>
                        <th class="qty-column">Qté</th>
                        <th class="product-column">Produit</th>
                        <th class="unit-price-column">Prix Unitaire</th>
                        <th class="total-column">Total</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Ajouter les articles livrés
    (order.deliveredItems || []).forEach(item => {
        const itemTotal = (parseFloat(item.prix) * item.quantity).toFixed(2);
        
        detailsHTML += `
            <tr>
                <td class="qty-column">${item.quantity}</td>
                <td class="product-column">
                    <span class="product-name">${item.Nom}</span>
                </td>
                <td class="unit-price-column">${Formatter.formatPrice(item.prix)} CHF</td>
                <td class="total-column">${itemTotal} CHF</td>
            </tr>
        `;
    });
    
    detailsHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    // Ajouter la section des articles en attente s'il y en a
    if (order.remainingItems && order.remainingItems.length > 0) {
        detailsHTML += `
            <div class="pending-items-header">
                ARTICLES EN ATTENTE
            </div>
            
            <div class="pending-items-table">
                <table class="items-table">
                    <tbody>
        `;
        
        order.remainingItems.forEach(item => {
            detailsHTML += `
                <tr class="pending-item">
                    <td class="qty-column">${item.quantity}</td>
                    <td class="product-column">
                        <span class="product-name">${item.Nom}</span>
                    </td>
                    <td class="unit-price-column">-</td>
                    <td class="total-column">-</td>
                </tr>
            `;
        });
        
        detailsHTML += `
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // Ajouter le total et les informations du client
    detailsHTML += `
        <div class="order-total">
            <span class="order-total-label">Total</span>
            <span class="order-total-amount">${totalAmount} CHF</span>
        </div>

        <div class="client-info-section">
            <h3>Informations du Client</h3>
            <div class="client-details">
                <div class="client-detail-item">
                    <span class="client-detail-label">Nom</span>
                    <span class="client-detail-value">${order.userProfile?.fullName || 'N/A'}</span>
                </div>
                <div class="client-detail-item">
                    <span class="client-detail-label">Email</span>
                    <span class="client-detail-value">${order.userProfile?.email || 'N/A'}</span>
                </div>
                <div class="client-detail-item">
                    <span class="client-detail-label">Téléphone</span>
                    <span class="client-detail-value">${order.userProfile?.phone || 'N/A'}</span>
                </div>
                <div class="client-detail-item">
                    <span class="client-detail-label">Boutique</span>
                    <span class="client-detail-value">${order.userProfile?.shopName || 'N/A'}</span>
                </div>
            </div>
        </div>

        <div class="download-invoice-container">
            <a href="${API.getInvoiceDownloadLink(order.orderId, order.userId)}" 
               class="download-invoice-btn" 
               target="_blank">
                <i class="fas fa-file-pdf"></i> Télécharger la Facture
            </a>
        </div>
    `;
    
    // Mettre à jour le contenu de la modale
    orderDetailsContent.innerHTML = detailsHTML;
}

/**
 * Génère le lien de téléchargement de facture
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID de l'utilisateur
 * @returns {string} URL de téléchargement
 */
function generateInvoiceLink(orderId, userId) {
    return API.getInvoiceDownloadLink(orderId, userId);
}

// Exposer les fonctions publiques
export {
    viewOrderDetails,
    displayOrderDetails,
    generateInvoiceLink
};