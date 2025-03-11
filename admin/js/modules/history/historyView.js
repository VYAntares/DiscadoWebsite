/**
 * Visualisation détaillée d'une commande de l'historique
 * Ce module gère l'affichage des détails d'une commande traitée
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as Modal from '../../utils/modal.js';

/**
 * Affiche les détails d'une commande
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID de l'utilisateur
 */
async function viewOrderDetails(orderId, userId) {
    // Obtenir la référence DOM de la modale
    const orderModal = document.getElementById('orderModal');
    
    if (!orderModal) {
        console.error("Modal de détails de commande non trouvée");
        Notification.showNotification("Erreur: Modal de détails non trouvée", "error");
        return;
    }
    
    // Rechercher le conteneur de contenu dans la modale - essayer plusieurs sélecteurs
    let contentContainer = document.getElementById('orderModalContent');
    if (!contentContainer) {
        contentContainer = orderModal.querySelector('.modal-body');
    }
    if (!contentContainer) {
        contentContainer = orderModal.querySelector('.order-modal-content');
    }
    if (!contentContainer) {
        // Si aucun conteneur n'est trouvé, en créer un nouveau
        contentContainer = document.createElement('div');
        contentContainer.id = 'orderModalContent';
        contentContainer.className = 'modal-body order-modal-content';
        
        // Insérer le conteneur dans la modale
        const modalContent = orderModal.querySelector('.modal-content');
        if (modalContent) {
            // S'il y a déjà une structure modal-content, ajouter notre conteneur dedans
            modalContent.appendChild(contentContainer);
        } else {
            // Sinon, créer une structure complète
            const newModalContent = document.createElement('div');
            newModalContent.className = 'modal-content';
            newModalContent.innerHTML = `
                <div class="modal-header">
                    <h2>Détails de la commande #${orderId}</h2>
                    <span class="close-modal">&times;</span>
                </div>
            `;
            
            // Ajouter le gestionnaire d'événement pour fermer la modale
            const closeBtn = newModalContent.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    orderModal.style.display = 'none';
                });
            }
            
            newModalContent.appendChild(contentContainer);
            orderModal.appendChild(newModalContent);
        }
    }
    
    // Afficher l'indicateur de chargement
    contentContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p class="loading-text">Chargement des détails...</p>
        </div>
    `;
    
    // Afficher la modale
    try {
        // Essayer d'abord d'utiliser la fonction du module Modal
        Modal.showModal(orderModal);
    } catch (e) {
        // Fallback en cas d'erreur
        orderModal.style.display = 'flex';
        orderModal.classList.add('active');
    }
    
    try {
        // Récupérer les détails de la commande
        const orderDetails = await API.fetchOrderDetails(orderId, userId);
        
        // Attendre un court instant pour s'assurer que la modale est visible
        // Cela peut aider à résoudre des problèmes de rendu
        setTimeout(() => {
            // Afficher les détails de la commande
            displayOrderDetails(orderDetails, contentContainer);
        }, 100);
    } catch (error) {
        console.error('Erreur lors du chargement des détails de la commande:', error);
        
        // Afficher un message d'erreur
        contentContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement des détails de la commande.</p>
                <p>Détails: ${error.message || "Erreur inconnue"}</p>
                <button class="action-btn retry-btn" id="retryButton">
                    <i class="fas fa-sync"></i> Réessayer
                </button>
            </div>
        `;
        
        // Ajouter un gestionnaire d'événement pour le bouton de réessai
        const retryButton = contentContainer.querySelector('#retryButton');
        if (retryButton) {
            retryButton.addEventListener('click', () => viewOrderDetails(orderId, userId));
        }
        
        // Notification d'erreur
        Notification.showNotification("Erreur lors du chargement des détails", "error");
    }
}

/**
 * Affiche les détails d'une commande dans la modale
 * @param {Object} order - Détails de la commande
 * @param {HTMLElement} container - Conteneur pour afficher les détails
 */
function displayOrderDetails(order, container) {
    if (!order || !container) {
        console.error("Données de commande ou conteneur manquant");
        return;
    }
    
    // Formater les dates pour l'affichage
    const orderDate = order.date ? Formatter.formatDate(order.date) : 'N/A';
    const processDate = order.lastProcessed ? Formatter.formatDate(order.lastProcessed) : 'N/A';
    
    // Calculer le montant total uniquement pour les articles livrés
    const totalAmount = ((order.deliveredItems || []).reduce((total, item) => {
        return total + (parseFloat(item.prix || 0) * (item.quantity || 0));
    }, 0)).toFixed(2);
    
    // Déterminer le statut de la commande
    let statusText = 'COMPLÈTE';
    let statusClass = 'status-completed';
    
    if (order.remainingItems && order.remainingItems.length > 0) {
        statusText = 'PARTIELLEMENT LIVRÉE';
        statusClass = 'status-partial';
    }
    
    // Construire le contenu HTML des détails de la commande
    let detailsHTML = `
        <div class="order-detail-header">
            <div class="order-detail-title">
                <div class="order-number">Commande #${order.orderId || 'N/A'}</div>
                <div class="order-dates">
                    <div>Commandée le: ${orderDate}</div>
                    <div>Traitée le: ${processDate}</div>
                </div>
            </div>
            <div class="order-status">
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
        </div>

        <div class="order-items-section">
            <h3 class="section-title">Articles livrés</h3>
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
    
    // Ajouter les articles livrés groupés par catégorie
    if (order.deliveredItems && order.deliveredItems.length > 0) {
        // Grouper les articles par catégorie
        const groupedItems = {};
        order.deliveredItems.forEach(item => {
            const category = item.categorie || 'autres';
            if (!groupedItems[category]) {
                groupedItems[category] = [];
            }
            groupedItems[category].push(item);
        });
        
        // Trier les catégories par ordre alphabétique
        const sortedCategories = Object.keys(groupedItems).sort();
        
        // Ajouter chaque catégorie et ses articles
        sortedCategories.forEach(category => {
            detailsHTML += `
                <tr>
                    <td colspan="4" class="category-section">
                        ${category.charAt(0).toUpperCase() + category.slice(1)}
                    </td>
                </tr>
            `;
            
            groupedItems[category].forEach(item => {
                const itemTotal = (parseFloat(item.prix || 0) * (item.quantity || 0)).toFixed(2);
                
                detailsHTML += `
                    <tr>
                        <td class="qty-column">${item.quantity || 0}</td>
                        <td class="product-column">
                            <span class="product-name">${item.Nom || 'Produit sans nom'}</span>
                        </td>
                        <td class="unit-price-column">${Formatter.formatPrice(item.prix || 0)} CHF</td>
                        <td class="total-column">${itemTotal} CHF</td>
                    </tr>
                `;
            });
        });
    } else {
        detailsHTML += `
            <tr>
                <td colspan="4" class="no-items">Aucun article livré</td>
            </tr>
        `;
    }
    
    detailsHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    // Ajouter la section des articles en attente s'il y en a
    if (order.remainingItems && order.remainingItems.length > 0) {
        detailsHTML += `
            <div class="pending-items-section">
                <h3 class="section-title pending-title">Articles en attente</h3>
                <table class="items-table pending-table">
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
        
        // Grouper les articles en attente par catégorie
        const groupedRemainingItems = {};
        order.remainingItems.forEach(item => {
            const category = item.categorie || 'autres';
            if (!groupedRemainingItems[category]) {
                groupedRemainingItems[category] = [];
            }
            groupedRemainingItems[category].push(item);
        });
        
        // Trier les catégories par ordre alphabétique
        const sortedRemainingCategories = Object.keys(groupedRemainingItems).sort();
        
        // Ajouter chaque catégorie et ses articles
        sortedRemainingCategories.forEach(category => {
            detailsHTML += `
                <tr>
                    <td colspan="4" class="category-section pending-category">
                        ${category.charAt(0).toUpperCase() + category.slice(1)}
                    </td>
                </tr>
            `;
            
            groupedRemainingItems[category].forEach(item => {
                detailsHTML += `
                    <tr class="pending-item">
                        <td class="qty-column">${item.quantity || 0}</td>
                        <td class="product-column">
                            <span class="product-name">${item.Nom || 'Produit sans nom'}</span>
                        </td>
                        <td class="unit-price-column">${Formatter.formatPrice(item.prix || 0)} CHF</td>
                        <td class="total-column">En attente</td>
                    </tr>
                `;
            });
        });
        
        detailsHTML += `
                    </tbody>
                </table>
                <div class="pending-notice">
                    <i class="fas fa-info-circle"></i> 
                    Ces articles seront livrés ultérieurement lorsqu'ils seront disponibles.
                </div>
            </div>
        `;
    }
    
    // Ajouter le total et les informations du client
    detailsHTML += `
        <div class="order-summary">
            <div class="order-total">
                <span class="order-total-label">Total livré</span>
                <span class="order-total-amount">${totalAmount} CHF</span>
            </div>
        </div>

        <div class="client-info-section">
            <h3 class="section-title">Informations du Client</h3>
            <div class="client-details">
                <div class="client-detail-grid">
                    <div class="client-detail-item">
                        <span class="client-detail-label">Nom</span>
                        <span class="client-detail-value">${order.userProfile?.fullName || order.userId || 'N/A'}</span>
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
        </div>

        <div class="order-actions-footer">
            <a href="${API.getInvoiceDownloadLink(order.orderId, order.userId)}" 
               class="download-invoice-btn" 
               target="_blank">
                <i class="fas fa-file-pdf"></i> Télécharger la Facture
            </a>
            <button class="close-detail-btn" id="closeOrderModal">
                <i class="fas fa-times"></i> Fermer
            </button>
        </div>
    `;
    
    // Mettre à jour le contenu de la modale
    container.innerHTML = detailsHTML;
    
    // Ajouter l'écouteur d'événement pour le bouton de fermeture
    const closeButton = container.querySelector('#closeOrderModal');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            const modal = document.getElementById('orderModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
            }
        });
    }
}

/**
 * Afficher les détails d'une commande directement depuis la vue client
 * @param {string} orderId - ID de la commande
 * @param {string} userId - ID du client
 */
function showOrderDetailsFromClientView(orderId, userId) {
    // Vérifier si la modale existe déjà
    let orderModal = document.getElementById('orderModal');
    
    // Si la modale n'existe pas, la créer
    if (!orderModal) {
        // Créer l'élément modale et l'ajouter au DOM
        orderModal = document.createElement('div');
        orderModal.id = 'orderModal';
        orderModal.className = 'modal';
        
        // Structure interne de la modale
        orderModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Détails de la commande #${orderId}</h2>
                    <span class="close-modal">&times;</span>
                </div>
                <div id="orderModalContent" class="modal-body">
                    <!-- Le contenu sera chargé dynamiquement -->
                </div>
            </div>
        `;
        
        // Ajouter la modale au body
        document.body.appendChild(orderModal);
        
        // Configurer les gestionnaires d'événements pour fermer la modale
        const closeBtn = orderModal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                orderModal.style.display = 'none';
                orderModal.classList.remove('active');
            });
        }
        
        // Fermeture en cliquant à l'extérieur
        window.addEventListener('click', (event) => {
            if (event.target === orderModal) {
                orderModal.style.display = 'none';
                orderModal.classList.remove('active');
            }
        });
    }
    
    // Appeler la fonction pour afficher les détails
    viewOrderDetails(orderId, userId);
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

// Exposer les fonctions dans window pour les rendre accessibles depuis HTML
window.viewOrderDetails = viewOrderDetails;
window.showOrderDetailsFromClientView = showOrderDetailsFromClientView;
window.generateInvoiceLink = generateInvoiceLink;

// Exposer les fonctions publiques
export {
    viewOrderDetails,
    displayOrderDetails,
    generateInvoiceLink,
    showOrderDetailsFromClientView
};