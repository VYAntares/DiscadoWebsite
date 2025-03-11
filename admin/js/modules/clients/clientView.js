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
let orderDetailsContent;
let clientDetailsTitle;

async function viewClientDetails(clientId) {
    // Obtenir les références DOM
    const orderModal = document.getElementById('orderModal');
    const orderDetailsContent = document.getElementById('orderDetailsContent');
    
    if (!orderModal || !orderDetailsContent) {
        console.error("Éléments de la modal non trouvés");
        return;
    }
    
    // Afficher l'indicateur de chargement
    orderDetailsContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            Chargement des détails du client...
        </div>
    `;
    
    // Afficher la modale
    Modal.showModal(orderModal);
    
    try {
        // Récupérer les détails du client
        const clients = await API.fetchClientProfiles();
        const client = clients.find(c => c.clientId === clientId);
        
        if (!client) {
            throw new Error(`Client ${clientId} non trouvé`);
        }
        
        // Récupérer l'historique des commandes du client
        const orders = await API.fetchClientOrders(clientId);
        
        // Construire le HTML pour les détails du client
        const html = `
            <div class="client-section">
                <div class="client-header">
                    <h2 class="client-title">Détails du client: ${client.clientId}</h2>
                    <button class="client-close-btn" onclick="document.getElementById('orderModal').style.display='none'">&times;</button>
                </div>

                <!-- Informations personnelles -->
                <div class="info-section">
                    <h3 class="info-section-title">Informations personnelles</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Prénom</span>
                            <span class="info-value">${client.firstName || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Nom</span>
                            <span class="info-value">${client.lastName || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Email</span>
                            <span class="info-value">${client.email || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Téléphone</span>
                            <span class="info-value">${client.phone || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <!-- Informations boutique -->
                <div class="info-section">
                    <h3 class="info-section-title">Informations boutique</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Nom de la boutique</span>
                            <span class="info-value">${client.shopName || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Adresse</span>
                            <span class="info-value">${client.shopAddress || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Ville</span>
                            <span class="info-value">${client.shopCity || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Code postal</span>
                            <span class="info-value">${client.shopZipCode || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <!-- Section Articles en attente -->
                ${renderPendingDeliverySection(orders)}

                <!-- Section Historique des commandes -->
                ${renderOrderHistorySection(orders)}
            </div>
        `;
        
        // Mettre à jour le contenu de la modale
        orderDetailsContent.innerHTML = html;
        
        // Configurer les événements si nécessaire
        setupClientDetailsEvents();
    } catch (error) {
        console.error('Erreur lors du chargement des détails du client:', error);
        
        orderDetailsContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement des détails du client</p>
                <p>${error.message}</p>
                <button class="action-btn" id="retryLoadClient">Réessayer</button>
            </div>
        `;
        
        // Ajouter l'écouteur pour le bouton de réessai
        const retryButton = document.getElementById('retryLoadClient');
        if (retryButton) {
            retryButton.addEventListener('click', () => viewClientDetails(clientId));
        }
    }
}

// Fonctions auxiliaires pour rendre les sections

function renderPendingDeliverySection(orders) {
    const pendingDelivery = orders.find(order => order.orderId === 'pending-delivery');
    
    if (!pendingDelivery || !pendingDelivery.items || pendingDelivery.items.length === 0) {
        return '';
    }
    
    // Logique de rendu des articles en attente de livraison
    let pendingItemsHtml = pendingDelivery.items.map(item => `
        <tr>
            <td>${item.Nom}</td>
            <td>${item.quantity}</td>
            <td>${item.prix} CHF</td>
        </tr>
    `).join('');
    
    return `
        <div class="delivery-section">
            <h3 class="info-section-title">Articles en attente de livraison</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Article</th>
                        <th>Quantité</th>
                        <th>Prix</th>
                    </tr>
                </thead>
                <tbody>
                    ${pendingItemsHtml}
                </tbody>
            </table>
        </div>
    `;
}

function renderOrderHistorySection(orders) {
    // Filtrer les commandes réelles (exclure pending-delivery)
    const validOrders = orders.filter(order => order.orderId !== 'pending-delivery');
    
    if (validOrders.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-shopping-cart"></i>
                <p>Aucune commande pour ce client</p>
            </div>
        `;
    }
    
    // Trier les commandes par date (les plus récentes en premier)
    validOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let ordersHtml = validOrders.map(order => `
        <tr>
            <td>${order.orderId}</td>
            <td>${new Date(order.date).toLocaleDateString()}</td>
            <td>${order.items.reduce((sum, item) => sum + item.quantity, 0)} articles</td>
            <td>
                <button class="action-btn view-btn" onclick="showOrderDetailsFromClientView('${order.orderId}', '${order.userId}')">
                    Voir détails
                </button>
            </td>
        </tr>
    `).join('');
    
    return `
        <div class="orders-history-section">
            <h3 class="info-section-title">Historique des commandes</h3>
            <table class="orders-table">
                <thead>
                    <tr>
                        <th>Commande</th>
                        <th>Date</th>
                        <th>Articles</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${ordersHtml}
                </tbody>
            </table>
        </div>
    `;
}

function setupClientDetailsEvents() {
    // Ajoutez ici des événements supplémentaires si nécessaire
}

// Exposer cette fonction globalement pour l'appel depuis onclick
window.showOrderDetailsFromClientView = function(orderId, userId) {
    import('./historyView.js').then(module => {
        module.viewOrderDetails(orderId, userId);
    });
};
/**
 * Affiche les détails d'un client dans la modale
 * @param {Object} client - Données du client
 */
async function displayClientDetails(client) {
    // Mettre en titre l'ID du client
    clientDetailsTitle.textContent = `Détails du client: ${client.clientId || 'N/A'}`;
    
    // Formatter la date de dernière mise à jour
    const lastUpdated = client.lastUpdated ? Formatter.formatDate(client.lastUpdated) : 'N/A';
    
    // Construire le contenu HTML pour les détails du client avec le nouveau design
    let html = `
        <div class="client-section">
            <div class="client-header">
                <h2 class="client-title">Détails du client: ${client.clientId || 'N/A'}</h2>
                <button class="client-close-btn" id="closeClientModal">&times;</button>
            </div>

            <!-- Section Informations personnelles -->
            <div class="info-section">
                <h3 class="info-section-title">Informations personnelles</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">ID Client:</span>
                        <span class="info-value">${client.clientId || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Prénom:</span>
                        <span class="info-value">${client.firstName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Nom:</span>
                        <span class="info-value">${client.lastName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Email:</span>
                        <span class="info-value">${client.email || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Téléphone:</span>
                        <span class="info-value">${client.phone || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <!-- Section Informations boutique -->
            <div class="info-section">
                <h3 class="info-section-title">Informations boutique</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Nom de la boutique:</span>
                        <span class="info-value">${client.shopName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Adresse:</span>
                        <span class="info-value">${client.shopAddress || client.address || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Ville:</span>
                        <span class="info-value">${client.shopCity || client.city || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Code postal:</span>
                        <span class="info-value">${client.shopZipCode || client.postalCode || 'N/A'}</span>
                    </div>
                </div>
            </div>
            
            <div id="pending-delivery-container"></div>
            <div id="client-orders-container"></div>
        </div>
    `;
    
    // Mettre à jour le contenu de la modale
    orderDetailsContent.innerHTML = html;
    
    // Ajouter un gestionnaire d'événements pour le bouton de fermeture
    document.getElementById('closeClientModal').addEventListener('click', function() {
        Modal.hideModal(clientModal);
    });
    
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
        // Aucun article en attente - ne pas afficher la section
        return;
    }
    
    // Grouper les articles par catégorie
    const groupedItems = {};
    pendingDelivery.items.forEach(item => {
        const category = item.categorie || 'autres';
        if (!groupedItems[category]) {
            groupedItems[category] = [];
        }
        groupedItems[category].push(item);
    });
    
    // Construire le HTML pour les articles en attente avec le nouveau design
    let html = `
        <div class="delivery-section">
            <h3 class="info-section-title">
                <i class="fas fa-truck delivery-icon"></i>Articles en attente de livraison
            </h3>
            <div class="delivery-table-container">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="select-all-pending" title="Sélectionner tout"></th>
                            <th>Article</th>
                            <th>Catégorie</th>
                            <th>Quantité</th>
                            <th>Prix unitaire</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Trier les catégories par ordre alphabétique
    const sortedCategories = Object.keys(groupedItems).sort();
    
    // Variable pour générer des IDs uniques
    let itemCounter = 0;
    
    // Ajouter les articles par catégorie
    sortedCategories.forEach(category => {
        html += `
            <tr>
                <td colspan="5" class="category-header">${category.charAt(0).toUpperCase() + category.slice(1)}</td>
            </tr>
        `;
        
        groupedItems[category].forEach(item => {
            const itemId = `pending-item-${itemCounter++}`;
            html += `
                <tr>
                    <td>
                        <input type="checkbox" 
                               id="${itemId}" 
                               class="select-pending-item" 
                               data-name="${item.Nom}" 
                               data-price="${item.prix}" 
                               data-quantity="${item.quantity}" 
                               data-category="${item.categorie || 'autres'}">
                    </td>
                    <td>${item.Nom}</td>
                    <td>${item.categorie || 'Autre'}</td>
                    <td>${item.quantity}</td>
                    <td>${Formatter.formatPrice(item.prix)} CHF</td>
                </tr>
            `;
        });
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            <div class="pending-actions" style="margin-top: 15px; text-align: right;">
                <button id="create-order-from-pending" class="action-btn primary-btn" data-client-id="${clientId}">
                    <i class="fas fa-shopping-cart"></i> Créer une commande avec les articles sélectionnés
                </button>
            </div>
        </div>
    `;
    
    // Mettre à jour le conteneur
    container.innerHTML = html;
    
    // Ajouter les écouteurs d'événements après avoir inséré le HTML
    setupPendingDeliveryEvents(clientId);
}

/**
 * Configure les écouteurs d'événements pour les articles en attente
 * @param {string} clientId - ID du client
 */
function setupPendingDeliveryEvents(clientId) {
    // Sélectionner/désélectionner tous les articles
    const selectAllCheckbox = document.getElementById('select-all-pending');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            document.querySelectorAll('.select-pending-item').forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        });
    }
    
    // Bouton pour créer une commande à partir des articles sélectionnés
    const createOrderBtn = document.getElementById('create-order-from-pending');
    if (createOrderBtn) {
        createOrderBtn.addEventListener('click', function() {
            const selectedItems = [];
            document.querySelectorAll('.select-pending-item:checked').forEach(checkbox => {
                selectedItems.push({
                    Nom: checkbox.getAttribute('data-name'),
                    prix: checkbox.getAttribute('data-price'),
                    quantity: parseInt(checkbox.getAttribute('data-quantity')),
                    categorie: checkbox.getAttribute('data-category')
                });
            });
            
            if (selectedItems.length > 0) {
                createOrderFromPendingItems(clientId, selectedItems);
            } else {
                Notification.showNotification('Veuillez sélectionner au moins un article', 'warning');
            }
        });
    }
}

/**
 * Crée une commande à partir des articles en attente sélectionnés
 * @param {string} clientId - ID du client
 * @param {Array} items - Articles sélectionnés
 */
async function createOrderFromPendingItems(clientId, items) {
    try {
        const response = await fetch('/api/admin/create-order-from-pending', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: clientId,
                items: items
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            Notification.showNotification('Commande créée avec succès', 'success');
            // Rafraîchir l'affichage
            viewClientDetails(clientId);
        } else {
            Notification.showNotification(`Erreur: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        Notification.showNotification('Erreur de communication avec le serveur', 'error');
    }
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
    
    // Construire le HTML pour l'historique des commandes avec le nouveau design
    let html = `
        <div class="orders-history-section">
            <h3 class="info-section-title">Historique des commandes</h3>
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
                <td class="order-id">${order.orderId}</td>
                <td class="order-date">
                    Commandé: ${orderDate}<br>
                    ${order.lastProcessed ? `Traité: ${processDate}` : ''}
                </td>
                <td><span class="order-status">${statusText}</span></td>
                <td class="order-count">${totalItems} article${totalItems > 1 ? 's' : ''}</td>
                <td>
                    <button class="action-btn details-btn" onclick="showOrderDetailsFromClientView('${order.orderId}', '${clientId}')">
                        <i class="fas fa-eye"></i> Détails
                    </button>
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
    
    // Mettre la fonction viewOrderDetails dans l'objet window pour l'accessibilité via onclick
    window.viewOrderDetails = function(orderId, userId) {
        HistoryView.viewOrderDetails(orderId, userId);
    };
}

// Exposer les fonctions publiques
export {
    viewClientDetails,
    displayClientDetails,
    displayPendingDelivery,
    displayOrderHistory,
    createOrderFromPendingItems
};
