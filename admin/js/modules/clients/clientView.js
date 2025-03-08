/**
 * Visualisation détaillée d'un client
 * Ce module gère l'affichage des détails d'un client et de son historique
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as Modal from '../../utils/modal.js';
import * as HistoryView from '../history/historyView.js';

// Références DOM
let clientModal;
let clientDetailsContent;
let clientDetailsTitle;

/**
 * Affiche les détails d'un client
 * @param {string} clientId - ID du client
 */
async function viewClientDetails(clientId) {
    // Obtenir les références DOM
    clientModal = document.getElementById('clientModal');
    clientDetailsContent = document.getElementById('clientDetailsContent');
    clientDetailsTitle = document.getElementById('clientDetailsTitle');
    
    if (!clientModal || !clientDetailsContent) {
        console.error("Modal de détails client non trouvée");
        return;
    }
    
    // Afficher l'indicateur de chargement
    clientDetailsContent.innerHTML = `<div class="loading">Chargement des détails...</div>`;
    
    // Afficher la modale
    Modal.showModal(clientModal);
    
    try {
        // Récupérer tous les profils clients (méthode temporaire jusqu'à implémentation d'un API dédié)
        const clients = await API.fetchClientProfiles();
        
        // Rechercher le client par son ID
        const client = clients.find(c => c.clientId === clientId);
        
        if (client) {
            // Afficher les détails du client
            displayClientDetails(client);
        } else {
            // Afficher un message si le client n'est pas trouvé
            clientDetailsContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-slash"></i>
                    <p>Client non trouvé</p>
                    <p>Détails recherchés : ${clientId}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erreur lors du chargement des détails du client:', error);
        
        // Afficher un message d'erreur
        clientDetailsContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement des détails du client</p>
                <button class="action-btn" id="retryLoadClient">Réessayer</button>
            </div>
        `;
        
        // Ajouter l'écouteur pour le bouton de réessai
        const retryButton = document.getElementById('retryLoadClient');
        if (retryButton) {
            retryButton.addEventListener('click', function() {
                viewClientDetails(clientId);
            });
        }
    }
}

/**
 * Affiche les détails d'un client dans la modale
 * @param {Object} client - Données du client
 */
async function displayClientDetails(client) {
    // Mettre en titre l'ID du client
    clientDetailsTitle.textContent = `Détails du client: ${client.clientId || 'N/A'}`;
    
    // Formatter la date de dernière mise à jour
    const lastUpdated = client.lastUpdated ? Formatter.formatDate(client.lastUpdated) : 'N/A';
    
    // Construire le contenu HTML pour les détails du client
    let html = `
        <div class="client-details-section">
            <h3>Informations personnelles</h3>
            <div class="client-details-grid">
                <div class="detail-item">
                    <span class="detail-label">ID Client:</span>
                    <span class="detail-value">${client.clientId || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Prénom:</span>
                    <span class="detail-value">${client.firstName || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Nom:</span>
                    <span class="detail-value">${client.lastName || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value">${client.email || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Téléphone:</span>
                    <span class="detail-value">${client.phone || 'N/A'}</span>
                </div>
            </div>
        </div>
        
        <div class="client-details-section">
            <h3>Informations boutique</h3>
            <div class="client-details-grid">
                <div class="detail-item">
                    <span class="detail-label">Nom de la boutique:</span>
                    <span class="detail-value">${client.shopName || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Adresse:</span>
                    <span class="detail-value">${client.shopAddress || client.address || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Ville:</span>
                    <span class="detail-value">${client.shopCity || client.city || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Code postal:</span>
                    <span class="detail-value">${client.shopZipCode || client.postalCode || 'N/A'}</span>
                </div>
            </div>
        </div>
        
        <div class="client-details-section">
            <h3>Articles en attente de livraison</h3>
            <div id="pending-delivery-container" class="pending-delivery-container">
                <div class="loading">Chargement des articles en attente...</div>
            </div>
        </div>
        
        <div class="client-details-section">
            <h3>Historique des commandes</h3>
            <div id="client-orders-container" class="client-orders-container">
                <div class="loading">Chargement de l'historique...</div>
            </div>
        </div>
    `;
    
    // Mettre à jour le contenu de la modale
    clientDetailsContent.innerHTML = html;
    
    try {
        // Charger l'historique des commandes du client
        const orders = await API.fetchClientOrders(client.clientId);
        
        // Obtenir les références des conteneurs
        const pendingDeliveryContainer = document.getElementById('pending-delivery-container');
        const ordersContainer = document.getElementById('client-orders-container');
        
        // Séparer les commandes normales et la pending-delivery
        const pendingDelivery = orders.find(order => order.orderId === 'pending-delivery');
        const regularOrders = orders.filter(order => order.orderId !== 'pending-delivery');
        
        // Afficher les articles en attente de livraison
        displayPendingDelivery(pendingDeliveryContainer, pendingDelivery, client.clientId);
        
        // Afficher l'historique des commandes normales
        displayOrderHistory(ordersContainer, regularOrders, client.clientId);
    } catch (error) {
        console.error('Erreur lors du chargement des commandes:', error);
        
        // Afficher les erreurs
        document.getElementById('pending-delivery-container').innerHTML = `
            <div class="empty-state">
                <p>Erreur lors du chargement des articles en attente</p>
            </div>
        `;
        
        document.getElementById('client-orders-container').innerHTML = `
            <div class="empty-state">
                <p>Erreur lors du chargement de l'historique des commandes</p>
            </div>
        `;
    }
}

/**
 * Affiche les articles en attente de livraison
 * @param {HTMLElement} container - Conteneur à remplir
 * @param {Object} pendingDelivery - Données des articles en attente
 * @param {string} clientId - ID du client
 */
function displayPendingDelivery(container, pendingDelivery, clientId) {
    if (!pendingDelivery || !pendingDelivery.items || pendingDelivery.items.length === 0) {
        // Aucun article en attente
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>Aucun article en attente de livraison</p>
            </div>
        `;
        return;
    }
    
    // Grouper les articles par catégorie si ce n'est pas déjà fait
    let groupedItems = pendingDelivery.groupedItems;
    if (!groupedItems) {
        groupedItems = {};
        pendingDelivery.items.forEach(item => {
            const category = item.categorie || 'autres';
            if (!groupedItems[category]) {
                groupedItems[category] = [];
            }
            groupedItems[category].push(item);
        });
    }
    
    // Construire le tableau d'articles en attente
    let html = `
        <div class="pending-delivery-info">
            <div class="pending-label">
                <i class="fas fa-truck"></i> Articles à livrer
            </div>
        </div>
        <div class="pending-items-list">
    `;
    
    // Afficher les articles par catégorie
    Object.keys(groupedItems).forEach(category => {
        const items = groupedItems[category];
        
        html += `
            <div class="pending-category">
                <h4 class="category-title">${category}</h4>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Article</th>
                            <th>Quantité</th>
                            <th>Prix unitaire</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        items.forEach(item => {
            html += `
                <tr>
                    <td>${item.Nom}</td>
                    <td class="quantity-cell">${item.quantity}</td>
                    <td class="price-cell">${Formatter.formatPrice(item.prix)} CHF</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
    });
    
    html += `</div>`;
    
    // Mettre à jour le conteneur
    container.innerHTML = html;
}

/**
 * Affiche l'historique des commandes d'un client
 * @param {HTMLElement} container - Conteneur à remplir
 * @param {Array} orders - Liste des commandes
 * @param {string} clientId - ID du client
 */
function displayOrderHistory(container, orders, clientId) {
    if (!orders || orders.length === 0) {
        // Aucune commande
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Aucune commande pour ce client</p>
            </div>
        `;
        return;
    }
    
    // Trier les commandes par date (les plus récentes d'abord)
    orders.sort((a, b) => new Date(b.lastProcessed || b.date) - new Date(a.lastProcessed || a.date));
    
    // Construire le tableau des commandes
    let html = `
        <div class="client-orders-list">
            <table class="orders-table">
                <thead>
                    <tr>
                        <th>Commande #</th>
                        <th>Date</th>
                        <th>Statut</th>
                        <th>Articles</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    orders.forEach(order => {
        // Ne pas inclure pending-delivery
        if (order.orderId === 'pending-delivery') return;
        
        // Formater les dates
        const orderDate = Formatter.formatDate(order.date);
        const processDate = order.lastProcessed ? Formatter.formatDate(order.lastProcessed) : 'N/A';
        
        // Déterminer le statut
        let statusText = 'EN ATTENTE';
        let statusClass = 'status-pending';
        
        // Toutes les commandes traitées (completed ou partial) sont considérées comme complètes
        if (order.status === 'completed' || order.status === 'partial') {
            statusText = 'COMPLÈTE';
            statusClass = 'status-completed';
        }
        
        // Calculer le nombre total d'articles
        const totalItems = (order.deliveredItems || order.items || []).reduce((sum, item) => sum + item.quantity, 0);
        
        html += `
            <tr>
                <td>${order.orderId}</td>
                <td>
                    Commandé: ${orderDate}<br>
                    ${order.lastProcessed ? `Traité: ${processDate}` : ''}
                </td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${totalItems} article${totalItems > 1 ? 's' : ''}</td>
                <td class="action-cell">
                    <div class="action-container">
        `;
        
        if (order.status === 'pending') {
            html += `
                        <a href="/admin" class="action-btn process-btn">
                            <i class="fas fa-tasks"></i> Traiter
                        </a>
            `;
        } else {
            html += `
                        <button class="action-btn view-details-btn" data-order-id="${order.orderId}" data-client-id="${clientId}">
                            <i class="fas fa-eye"></i> Détails
                        </button>
            `;
        }
        
        html += `
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    // Mettre à jour le conteneur
    container.innerHTML = html;
    
    // Ajouter les écouteurs d'événements pour les boutons de détails
    container.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const orderId = this.getAttribute('data-order-id');
            const clientId = this.getAttribute('data-client-id');
            HistoryView.viewOrderDetails(orderId, clientId);
        });
    });
}

// Exposer les fonctions publiques
export {
    viewClientDetails,
    displayClientDetails,
    displayPendingDelivery,
    displayOrderHistory
};