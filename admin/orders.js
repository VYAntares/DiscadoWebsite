document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    const orderList = document.getElementById('orderList');
    const orderModal = document.getElementById('orderModal');
    const orderDetailsContent = document.getElementById('orderDetailsContent');
    const orderDetailsTitle = document.getElementById('orderDetailsTitle');
    const closeModal = document.querySelector('.close-modal');
    
    // Charger les commandes en attente
    loadPendingOrders();
    
    // Fonction pour formatter la date
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Fonction pour charger les commandes en attente depuis l'API
    function loadPendingOrders() {
        orderList.innerHTML = `
            <div class="loading">Chargement des commandes...</div>
        `;
        
        fetch('/api/admin/pending-orders')
            .then(response => response.json())
            .then(orders => {
                displayOrders(orders);
            })
            .catch(error => {
                console.error('Erreur lors du chargement des commandes:', error);
                orderList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erreur lors du chargement des commandes. Veuillez réessayer.</p>
                        <button class="action-btn" onclick="loadPendingOrders()">Réessayer</button>
                    </div>
                `;
            });
    }
    
    // Fonction pour afficher les commandes
    function displayOrders(orders) {
        if (orders.length === 0) {
            orderList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <p>Aucune commande en attente pour le moment.</p>
                </div>
            `;
            return;
        }
        
        orderList.innerHTML = '';
        
        // Trier les commandes du plus ancien au plus récent
        orders.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        orders.forEach(order => {
            const orderDate = formatDate(order.date);
            
            // Calculer le nombre total d'articles
            const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
            
            // Récupérer les 3 premiers noms d'articles pour l'aperçu
            const itemsPreview = order.items.slice(0, 3).map(item => {
                const shortName = item.Nom.split(' - ')[0]; // Prendre juste la première partie du nom
                return shortName;
            }).join(', ');
            
            // Informations du client
            const userProfile = order.userProfile || {};
            const customerName = userProfile.fullName || order.userId;
            const shopName = userProfile.shopName || 'Non spécifié';
            const email = userProfile.email || 'Non spécifié';
            const phone = userProfile.phone || 'Non spécifié';
            
            const orderItem = document.createElement('div');
            orderItem.className = 'order-item';
            orderItem.innerHTML = `
                <div class="order-details">
                    <div class="order-id">
                        <i class="fas fa-shopping-cart"></i>
                        Commande #${order.orderId}
                    </div>
                    <div class="order-date">${orderDate}</div>
                    <div class="customer-info">
                        <div class="customer-name">${customerName}</div>
                        <div class="customer-shop">Boutique: ${shopName}</div>
                        <div class="customer-contact">Email: ${email} | Tél: ${phone}</div>
                    </div>
                    <div class="order-items">
                        <div class="item-count">${totalItems} article${totalItems > 1 ? 's' : ''} au total</div>
                        <div class="items-preview">${itemsPreview}${order.items.length > 3 ? '...' : ''}</div>
                    </div>
                </div>
                <div class="order-actions">
                    <button class="action-btn view-btn" data-order-id="${order.orderId}">
                        <i class="fas fa-eye"></i> Voir détails
                    </button>
                    <button class="action-btn process-btn" data-order-id="${order.orderId}" data-user-id="${order.userId}">
                        <i class="fas fa-check"></i> Traiter commande
                    </button>
                </div>
            `;
            
            orderList.appendChild(orderItem);
        });
        
        // Ajouter les écouteurs d'événements pour les boutons
        document.querySelectorAll('.view-btn').forEach(button => {
            button.addEventListener('click', function() {
                const orderId = this.getAttribute('data-order-id');
                viewOrderDetails(orderId);
            });
        });
        
        document.querySelectorAll('.process-btn').forEach(button => {
            button.addEventListener('click', function() {
                const orderId = this.getAttribute('data-order-id');
                const userId = this.getAttribute('data-user-id');
                processOrder(orderId, userId);
            });
        });
    }
    
    // Fonction pour voir les détails d'une commande
    function viewOrderDetails(orderId) {
        // Animation de chargement dans la modal
        orderDetailsContent.innerHTML = `<div class="loading">Chargement des détails...</div>`;
        orderModal.style.display = 'block';
        orderDetailsTitle.textContent = `Détails de la commande #${orderId}`;
        
        // Charger les détails de la commande
        fetch('/api/admin/pending-orders')
            .then(response => response.json())
            .then(orders => {
                const order = orders.find(o => o.orderId === orderId);
                if (order) {
                    displayOrderDetails(order);
                } else {
                    orderDetailsContent.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>Commande non trouvée</p>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des détails de la commande:', error);
                orderDetailsContent.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erreur lors du chargement des détails de la commande</p>
                    </div>
                `;
            });
    }
    
    // Fonction pour afficher les détails de la commande
    function displayOrderDetails(order) {
        const orderDate = formatDate(order.date);
        const userProfile = order.userProfile || {};
        
        let html = `
            <div class="order-section">
                <h3>Informations client</h3>
                <div class="order-details-grid">
                    <div class="detail-item">
                        <span class="detail-label">Nom:</span>
                        <span class="detail-value">${userProfile.fullName || order.userId || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Boutique:</span>
                        <span class="detail-value">${userProfile.shopName || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${userProfile.email || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Téléphone:</span>
                        <span class="detail-value">${userProfile.phone || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Adresse:</span>
                        <span class="detail-value">${userProfile.shopAddress || userProfile.address || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Ville:</span>
                        <span class="detail-value">${userProfile.shopCity || userProfile.city || 'N/A'} ${userProfile.shopZipCode || userProfile.postalCode || ''}</span>
                    </div>
                </div>
            </div>
            
            <div class="order-section">
                <h3>Détails de la commande</h3>
                <div class="order-meta">
                    <div class="meta-item">
                        <span class="meta-label">ID commande:</span>
                        <span class="meta-value">${order.orderId}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Date:</span>
                        <span class="meta-value">${orderDate}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Statut:</span>
                        <span class="meta-value status-badge">En attente</span>
                    </div>
                </div>
                
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Article</th>
                            <th>Catégorie</th>
                            <th>Prix unitaire</th>
                            <th>Quantité</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        let orderTotal = 0;
        
        order.items.forEach(item => {
            const itemTotal = parseFloat(item.prix) * item.quantity;
            orderTotal += itemTotal;
            
            html += `
                <tr>
                    <td>${item.Nom}</td>
                    <td>${item.categorie || 'N/A'}</td>
                    <td>${parseFloat(item.prix).toFixed(2)} CHF</td>
                    <td>${item.quantity}</td>
                    <td>${itemTotal.toFixed(2)} CHF</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" class="total-label">Total:</td>
                            <td class="total-value">${orderTotal.toFixed(2)} CHF</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div class="order-actions-container">
                <button class="action-btn process-order-btn" data-order-id="${order.orderId}" data-user-id="${order.userId}">
                    <i class="fas fa-check"></i> Traiter cette commande
                </button>
            </div>
        `;
        
        orderDetailsContent.innerHTML = html;
        
        // Ajouter l'écouteur d'événement pour le bouton de traitement
        document.querySelector('.process-order-btn').addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            const userId = this.getAttribute('data-user-id');
            orderModal.style.display = 'none';
            processOrder(orderId, userId);
        });
    }
    
    // Fonction pour traiter une commande
    function processOrder(orderId, userId) {
        console.log('Préparation au traitement de la commande:', orderId, 'pour utilisateur:', userId);
        
        // Dans une version réelle, on ouvrirait une autre modale pour confirmer et entrer les quantités livrées
        // Pour cet exemple simplifié, on va juste afficher une notification
        showNotification(`Fonctionnalité "Traiter commande" à implémenter pour #${orderId}`, 'info');
        
        // À implémenter: Modale pour sélectionner les articles à livrer
        // createProcessOrderModal(orderId, userId);
    }
    
    // Fermer la modal quand on clique sur la croix
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            orderModal.style.display = 'none';
        });
    }
    
    // Fermer la modal quand on clique en dehors du contenu
    window.addEventListener('click', function(event) {
        if (event.target === orderModal) {
            orderModal.style.display = 'none';
        }
    });
    
    // Fonction pour afficher une notification
    function showNotification(message, type = 'success') {
        // Vérifier si le conteneur de notification existe, sinon le créer
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
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
    
    // Rendre les fonctions accessibles globalement
    window.loadPendingOrders = loadPendingOrders;
    window.showNotification = showNotification;
});