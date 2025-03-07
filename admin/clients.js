document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    const clientTableBody = document.getElementById('clientTableBody');
    const clientModal = document.getElementById('clientModal');
    const clientDetailsContent = document.getElementById('clientDetailsContent');
    const clientDetailsTitle = document.getElementById('clientDetailsTitle');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const closeModal = document.querySelector('.close-modal');
    const orderDetailsModal = document.getElementById('orderDetailsModal');
    const orderModalContent = document.getElementById('orderModalContent');
    const orderModalTitle = document.getElementById('orderModalTitle');
    
    // Fonction pour formater la date
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-CH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Charger la liste des clients
    loadClients();
    
    // Fonction pour charger la liste des clients
    function loadClients() {
        clientTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="loading">Chargement des clients...</td>
            </tr>
        `;
        
        fetch('/api/admin/client-profiles')
            .then(response => response.json())
            .then(clients => {
                displayClients(clients);
            })
            .catch(error => {
                console.error('Erreur lors du chargement des clients:', error);
                clientTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="loading">
                            Erreur lors du chargement des clients. Veuillez réessayer.
                            <br><button class="action-btn" onclick="loadClients()">Réessayer</button>
                        </td>
                    </tr>
                `;
            });
    }
    
    // Fonction pour afficher les clients dans le tableau
    function displayClients(clients) {
        if (clients.length === 0) {
            clientTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>Aucun client trouvé.</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        clientTableBody.innerHTML = '';
        
        clients.forEach(client => {
            // Récupérer l'ID du client depuis client.clientId
            const clientId = client.clientId || 'N/A';
            // Concaténer Prénom + Nom pour l'affichage (ou 'N/A' si vide)
            const fullName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'N/A';
            const shopName = client.shopName || 'N/A';
            const email = client.email || 'N/A';
            const phone = client.phone || 'N/A';
            
            const row = document.createElement('tr');
            // Modifier cette partie pour ajouter des styles inline
            row.innerHTML = `
                <td>
                    <span class="client-id">${clientId}</span>
                </td>
                <td>
                    <div class="client-info">
                        <span class="client-name">${fullName}</span>
                        <span class="client-shop">${shopName}</span>
                        <div class="client-contact-mobile">
                            <a href="mailto:${email}" class="contact-link"><i class="fas fa-envelope"></i></a>
                            <a href="tel:${phone}" class="contact-link"><i class="fas fa-phone"></i></a>
                        </div>
                    </div>
                </td>
                <td style="vertical-align: middle; text-align: center;">
                    <button class="action-btn view-client-btn" data-client-id="${clientId}" style="margin: 0 auto;">
                        <i class="fas fa-eye"></i> Voir détails
                    </button>
                </td>
            `;
            
            clientTableBody.appendChild(row);
        });
        
        // Ajouter les écouteurs d'événements pour les boutons "Voir détails"
        document.querySelectorAll('.view-client-btn').forEach(button => {
            button.addEventListener('click', function() {
                const clientId = this.getAttribute('data-client-id');
                viewClientDetails(clientId);
            });
        });
    }
    
    // Fonction pour afficher la fenêtre modale des détails d'un client
    function viewClientDetails(clientId) {
        // Animation de chargement dans la modal
        clientDetailsContent.innerHTML = `<div class="loading">Chargement des détails...</div>`;
        clientModal.style.display = 'block';
        
        // Charger les détails du client
        fetch('/api/admin/client-profiles')
            .then(response => response.json())
            .then(clients => {
                // On recherche le client via son clientId
                const client = clients.find(c => c.clientId === clientId);
                
                if (client) {
                    displayClientDetails(client);
                } else {
                    clientDetailsContent.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-user-slash"></i>
                            <p>Client non trouvé</p>
                            <p>Détails recherchés : ${clientId}</p>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des détails du client:', error);
                clientDetailsContent.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erreur lors du chargement des détails du client</p>
                        <button class="action-btn" onclick="viewClientDetails('${clientId}')">Réessayer</button>
                    </div>
                `;
            });
    }
    

    
    // Fonction pour récupérer l'historique des commandes d'un client
    function getClientOrderHistory(clientId) {
        return fetch(`/api/admin/client-orders/${clientId}`)
            .then(response => response.json())
            .catch(error => {
                console.error('Error fetching client orders:', error);
                return [];
            });
    }
    
    // Modification à apporter dans clients.js 
    // Dans la fonction displayClientDetails, après avoir chargé les données client

    function displayClientDetails(client) {
        // Mettre en titre l'ID du client
        clientDetailsTitle.textContent = `Détails du client: ${client.clientId || 'N/A'}`;
        
        // Formatter la date de dernière mise à jour
        const lastUpdated = client.lastUpdated ? formatDate(client.lastUpdated) : 'N/A';
        
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
        
        // Mettre à jour le contenu de la modal
        clientDetailsContent.innerHTML = html;
        
        // Charger l'historique des commandes du client
        getClientOrderHistory(client.clientId)
            .then(orders => {
                const pendingDeliveryContainer = document.getElementById('pending-delivery-container');
                const ordersContainer = document.getElementById('client-orders-container');
                
                // Séparer les commandes normales et la pending-delivery
                const pendingDelivery = orders.find(order => order.orderId === 'pending-delivery');
                const regularOrders = orders.filter(order => order.orderId !== 'pending-delivery');
                
                // Afficher les articles en attente de livraison
                displayPendingDelivery(pendingDeliveryContainer, pendingDelivery, client.clientId);
                
                // Afficher l'historique des commandes normales
                displayOrderHistory(ordersContainer, regularOrders, client.clientId);
            });
    }

    // Nouvelle fonction pour afficher les articles en attente de livraison
    function displayPendingDelivery(container, pendingDelivery, clientId) {
        if (!pendingDelivery || !pendingDelivery.items || pendingDelivery.items.length === 0) {
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
                        <td class="price-cell">${parseFloat(item.prix).toFixed(2)} CHF</td>
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
        
        container.innerHTML = html;
    }

    // Modification à apporter dans la fonction displayOrderHistory dans clients.js

function displayOrderHistory(container, orders, clientId) {
    if (!orders || orders.length === 0) {
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
        
        const orderDate = formatDate(order.date);
        const processDate = order.lastProcessed ? formatDate(order.lastProcessed) : 'N/A';
        
        // Get status display
        let statusText = 'EN ATTENTE';
        let statusClass = 'status-pending';
        
        // Toutes les commandes traitées (completed ou partial) sont considérées comme complètes
        if (order.status === 'completed' || order.status === 'partial') {
            statusText = 'COMPLÈTE';
            statusClass = 'status-completed';
        }
        
        // Calculate total items
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
    
    container.innerHTML = html;
    
    // Ajouter les écouteurs d'événements pour les boutons de détails
    container.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const orderId = this.getAttribute('data-order-id');
            const clientId = this.getAttribute('data-client-id');
            viewOrderDetails(orderId, clientId);
        });
    });
}

// Modification similaire pour la fonction qui affiche les clients dans le tableau principal
function displayClients(clients) {
    if (clients.length === 0) {
        clientTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>Aucun client trouvé.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    clientTableBody.innerHTML = '';
    
    clients.forEach(client => {
        // Récupérer l'ID du client depuis client.clientId
        const clientId = client.clientId || 'N/A';
        // Concaténer Prénom + Nom pour l'affichage (ou 'N/A' si vide)
        const fullName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'N/A';
        const shopName = client.shopName || 'N/A';
        const email = client.email || 'N/A';
        const phone = client.phone || 'N/A';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <span class="client-id">${clientId}</span>
            </td>
            <td>
                <div class="client-info">
                    <span class="client-name">${fullName}</span>
                    <span class="client-shop">${shopName}</span>
                    <div class="client-contact-mobile">
                        <a href="mailto:${email}" class="contact-link"><i class="fas fa-envelope"></i></a>
                        <a href="tel:${phone}" class="contact-link"><i class="fas fa-phone"></i></a>
                    </div>
                </div>
            </td>
            <td class="action-cell">
                <div class="action-container">
                    <button class="action-btn view-client-btn" data-client-id="${clientId}">
                        <i class="fas fa-eye"></i> Voir détails
                    </button>
                </div>
            </td>
        `;
        
        clientTableBody.appendChild(row);
    });
    
    // Ajouter les écouteurs d'événements pour les boutons "Voir détails"
    document.querySelectorAll('.view-client-btn').forEach(button => {
        button.addEventListener('click', function() {
            const clientId = this.getAttribute('data-client-id');
            viewClientDetails(clientId);
        });
    });
}

    // Fonction pour afficher les détails d'une commande
    function viewOrderDetails(orderId, clientId) {
        orderModalContent.innerHTML = `<div class="loading">Chargement des détails...</div>`;
        orderDetailsModal.style.display = 'block';
        
        // Récupérer les détails de la commande
        fetch(`/api/admin/order-details/${orderId}/${clientId}`)
            .then(response => response.json())
            .then(orderDetails => {
                displayOrderDetailsModal(orderDetails, clientId);
            })
            .catch(error => {
                console.error('Erreur lors du chargement des détails de la commande:', error);
                orderModalContent.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erreur lors du chargement des détails de la commande.</p>
                    </div>
                `;
            });
    }
    
        // Fonction pour afficher les détails de la commande dans la modal
    function displayOrderDetailsModal(order, clientId) {
        const orderModalContent = document.getElementById('orderModalContent');
        const orderModalTitle = document.getElementById('orderModalTitle');
        
        const orderDate = formatDate(order.date);
        const processDate = formatDate(order.lastProcessed);
        
        // Calculer le montant total uniquement pour les articles livrés
        const totalAmount = (order.deliveredItems || []).reduce((total, item) => {
            return total + (parseFloat(item.prix) * item.quantity);
        }, 0).toFixed(2);
        
        // Statut de la commande (avec option "partiellement livrée" si applicable)
        let statusText = 'COMPLETED';
        let statusClass = 'status-completed';
        
        if (order.remainingItems && order.remainingItems.length > 0) {
            statusText = 'PARTIALLY SHIPPED';
            statusClass = 'status-partial';
        }
        
        // Définir le titre de la modal - plus simple, juste Order #ID
        orderModalTitle.textContent = `Order #${order.orderId.split('_').pop()}`;
        
        // Créer le HTML pour le contenu de la modal avec un style plus proche de l'image de référence
        let detailsHTML = `
            <div class="order-header">
                <div class="order-status-indicator">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
            </div>

            <div class="order-date-section">
                ${orderDate.split(',')[0]}
            </div>

            <div class="order-items-table">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th class="qty-column">Qty</th>
                            <th class="product-column">Product</th>
                            <th class="unit-price-column">Unit Price</th>
                            <th class="total-column">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Ajouter les articles livrés
        if (order.deliveredItems && order.deliveredItems.length > 0) {
            order.deliveredItems.forEach(item => {
                const itemTotal = (parseFloat(item.prix) * item.quantity).toFixed(2);
                
                detailsHTML += `
                    <tr>
                        <td class="qty-column">${item.quantity}</td>
                        <td class="product-column">${item.Nom}</td>
                        <td class="unit-price-column">${parseFloat(item.prix).toFixed(2)} CHF</td>
                        <td class="total-column">${itemTotal} CHF</td>
                    </tr>
                `;
            });
        }
        
        detailsHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Ajouter la section des articles en attente s'il y en a
        if (order.remainingItems && order.remainingItems.length > 0) {
            detailsHTML += `
                <div class="pending-items-header">
                    PENDING ITEMS
                </div>
                
                <div class="pending-items-table">
                    <table class="items-table">
                        <tbody>
            `;
            
            order.remainingItems.forEach(item => {
                detailsHTML += `
                    <tr>
                        <td class="qty-column">${item.quantity}</td>
                        <td class="product-column">${item.Nom}</td>
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
        
        // Ajouter le résumé et le bouton de téléchargement
        detailsHTML += `
            <div class="order-footer">
                <div class="order-total">
                    <span>Total: ${totalAmount} CHF</span>
                </div>
                <div class="download-invoice-btn-container">
                    <a href="/api/admin/download-invoice/${order.orderId}/${clientId}" class="download-invoice-btn" target="_blank">
                        <i class="fas fa-file-pdf"></i> Download Invoice
                    </a>
                </div>
            </div>
            
            <div class="client-info-section">
                <h3>Informations du client</h3>
                <div class="client-details">
                    <div class="client-detail-item">
                        <span class="detail-label">Nom:</span>
                        <span class="detail-value">${order.userProfile?.fullName || 'N/A'}</span>
                    </div>
                    <div class="client-detail-item">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${order.userProfile?.email || 'N/A'}</span>
                    </div>
                    <div class="client-detail-item">
                        <span class="detail-label">Téléphone:</span>
                        <span class="detail-value">${order.userProfile?.phone || 'N/A'}</span>
                    </div>
                    <div class="client-detail-item">
                        <span class="detail-label">Boutique:</span>
                        <span class="detail-value">${order.userProfile?.shopName || 'N/A'}</span>
                    </div>
                    <div class="client-detail-item">
                        <span class="detail-label">Adresse:</span>
                        <span class="detail-value">${order.userProfile?.shopAddress || 'N/A'}, ${order.userProfile?.shopCity || ''} ${order.userProfile?.shopZipCode || ''}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Mettre à jour le contenu de la modal
        orderModalContent.innerHTML = detailsHTML;
    }
    
    // Fermer la modal client quand on clique sur la croix
    closeModal.addEventListener('click', function() {
        clientModal.style.display = 'none';
    });
    
    // Fermer la modal quand on clique en dehors du contenu
    window.addEventListener('click', function(event) {
        if (event.target === clientModal) {
            clientModal.style.display = 'none';
        }
        if (event.target === orderDetailsModal) {
            orderDetailsModal.style.display = 'none';
        }
    });
    
    // Fermer la modal des détails de commande quand on clique sur la croix
    const closeOrderModal = document.querySelector('.close-order-modal');
    if (closeOrderModal) {
        closeOrderModal.addEventListener('click', function() {
            orderDetailsModal.style.display = 'none';
        });
    }
    
    // Fonction de recherche
    function searchClients() {
        const searchValue = searchInput.value.toLowerCase().trim();
        
        if (!searchValue) {
            loadClients();
            return;
        }
        
        // Afficher une indication de recherche
        clientTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="loading">Recherche en cours...</td>
            </tr>
        `;
        
        // Récupérer tous les clients puis filtrer
        fetch('/api/admin/client-profiles')
            .then(response => response.json())
            .then(clients => {
                const filteredClients = clients.filter(client => {
                    const fullName = (`${client.firstName || ''} ${client.lastName || ''}`).toLowerCase().trim();
                    const shopName = (client.shopName || '').toLowerCase();
                    const email = (client.email || '').toLowerCase();
                    const phone = (client.phone || '').toLowerCase();
                    const username = (client.username || '').toLowerCase();
                    const city = (client.shopCity || client.city || '').toLowerCase();
                    const cId = (client.clientId || '').toLowerCase();  // Pour pouvoir chercher par ID
                    
                    return (
                        fullName.includes(searchValue) ||
                        shopName.includes(searchValue) ||
                        email.includes(searchValue) ||
                        phone.includes(searchValue) ||
                        username.includes(searchValue) ||
                        city.includes(searchValue) ||
                        cId.includes(searchValue)
                    );
                });
                
                displayClients(filteredClients);
                
                // Afficher un message indiquant les résultats de recherche
                if (filteredClients.length > 0) {
                    showNotification(`${filteredClients.length} client(s) trouvé(s) pour "${searchValue}"`, 'info');
                } else {
                    showNotification(`Aucun client trouvé pour "${searchValue}"`, 'info');
                }
            })
            .catch(error => {
                console.error('Erreur lors de la recherche:', error);
                showNotification('Erreur lors de la recherche', 'error');
            });
    }
    
    // Fonction pour afficher une notification
    function showNotification(message, type = 'success') {
        // Vérifier si le conteneur de notification existe, sinon le créer
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.position = 'fixed';
            container.style.top = '20px';
            container.style.right = '20px';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }
        
        // Créer la notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Icône selon le type
        let icon = '✓';
        if (type === 'error') icon = '✕';
        if (type === 'info') icon = 'ℹ';
        
        // Structure de la notification
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                <div class="notification-message">${message}</div>
            </div>
        `;
        
        // Ajouter au conteneur
        container.appendChild(notification);
        
        // Supprimer après un délai
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    // Écouteur d'événement pour le bouton de recherche
    if (searchBtn) {
        searchBtn.addEventListener('click', searchClients);
    }
    
    // Recherche en appuyant sur Entrée
    if (searchInput) {
        searchInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                searchClients();
            }
        });
    }
});

// Ajoutez ce code à la fin de votre fonction document.addEventListener('DOMContentLoaded', function() {...}) dans clients.js

// Variables pour la création de client
const createClientBtn = document.getElementById('createClientBtn');
const createClientModal = document.getElementById('createClientModal');
const createClientForm = document.getElementById('createClientForm');
const closeCreateModal = document.querySelector('.close-create-modal');
const cancelCreateBtn = createClientModal.querySelector('.cancel-btn');

// Ouvrir le modal de création de client
if (createClientBtn) {
    createClientBtn.addEventListener('click', function() {
        createClientModal.style.display = 'block';
        // Focus sur le premier champ
        document.getElementById('newUsername').focus();
    });
}

// Fermer le modal de création
if (closeCreateModal) {
    closeCreateModal.addEventListener('click', function() {
        createClientModal.style.display = 'none';
        createClientForm.reset();
    });
}

// Fermer le modal avec le bouton Annuler
if (cancelCreateBtn) {
    cancelCreateBtn.addEventListener('click', function() {
        createClientModal.style.display = 'none';
        createClientForm.reset();
    });
}

// Fermer le modal quand on clique en dehors du contenu (mise à jour de l'écouteur existant)
window.addEventListener('click', function(event) {
    if (event.target === clientModal) {
        clientModal.style.display = 'none';
    }
    if (event.target === orderDetailsModal) {
        orderDetailsModal.style.display = 'none';
    }
    if (event.target === createClientModal) {
        createClientModal.style.display = 'none';
        createClientForm.reset();
    }
});

// Gestion du formulaire de création
if (createClientForm) {
    createClientForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Récupérer les identifiants (obligatoires)
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        
        // Vérifier que les champs requis sont remplis
        if (!username || !password) {
            showNotification('Nom d\'utilisateur et mot de passe requis', 'error');
            return;
        }
        
        // Récupérer les données de profil (facultatives)
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
        
        // Envoyer les données au serveur
        fetch('/api/admin/create-client', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                profileData
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Afficher un message de succès
                showNotification('Client créé avec succès : ' + username, 'success');
                
                // Fermer le modal et réinitialiser le formulaire
                createClientModal.style.display = 'none';
                createClientForm.reset();
                
                // Recharger la liste des clients
                loadClients();
            } else {
                // Afficher l'erreur
                showNotification('Erreur : ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            showNotification('Erreur lors de la création du client', 'error');
        });
    });
}