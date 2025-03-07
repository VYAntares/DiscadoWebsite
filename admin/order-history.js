document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    const historyOrderList = document.getElementById('historyOrderList');
    const orderModal = document.getElementById('orderModal');
    const orderDetailsContent = document.getElementById('orderDetailsContent');
    const orderDetailsTitle = document.getElementById('orderDetailsTitle');
    const closeModal = document.querySelector('.close-modal');
    const searchOrderInput = document.getElementById('searchOrderInput');
    const searchOrderBtn = document.getElementById('searchOrderBtn');
    
    // Variable pour stocker toutes les commandes chargées
    let allTreatedOrders = [];
    
    // Charger l'historique des commandes traitées
    loadTreatedOrders();
    
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

    // Fonction pour grouper les commandes par mois
    function groupOrdersByMonth(orders) {
        const monthGroups = {};
        
        orders.forEach(order => {
            const orderDate = new Date(order.lastProcessed || order.date);
            const monthKey = orderDate.toLocaleString('fr-FR', { year: 'numeric', month: 'long' });
            
            if (!monthGroups[monthKey]) {
                monthGroups[monthKey] = [];
            }
            
            monthGroups[monthKey].push(order);
        });
        
        return monthGroups;
    }

    // Fonction pour grouper les commandes par jour
    function groupOrdersByDay(monthOrders) {
        const dayGroups = {};
        
        monthOrders.forEach(order => {
            const orderDate = new Date(order.lastProcessed || order.date);
            const dayKey = orderDate.toLocaleString('fr-FR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            if (!dayGroups[dayKey]) {
                dayGroups[dayKey] = [];
            }
            
            dayGroups[dayKey].push(order);
        });
        
        return dayGroups;
    }

    // Fonction pour afficher la navigation hiérarchique
    function displayHierarchicalOrders(orders) {
        const historyOrderList = document.getElementById('historyOrderList');
        historyOrderList.innerHTML = '';
        
        const monthGroups = groupOrdersByMonth(orders);
        
        // Créer une vue par mois
        Object.keys(monthGroups).forEach(monthKey => {
            const monthContainer = document.createElement('div');
            monthContainer.className = 'month-group';
            
            const monthHeader = document.createElement('div');
            monthHeader.className = 'month-header';
            monthHeader.textContent = monthKey;
            monthHeader.setAttribute('data-month', monthKey);
            
            // Nombre total de commandes pour ce mois
            const monthOrderCount = monthGroups[monthKey].length;
            const monthOrderBadge = document.createElement('span');
            monthOrderBadge.className = 'month-order-count';
            monthOrderBadge.textContent = monthOrderCount;
            monthHeader.appendChild(monthOrderBadge);
            
            monthContainer.appendChild(monthHeader);
            
            // Zone pour les détails du mois (initialement cachée)
            const monthDetailsContainer = document.createElement('div');
            monthDetailsContainer.className = 'month-details hidden';
            monthContainer.appendChild(monthDetailsContainer);
            
            // Événement pour développer/réduire le mois
            monthHeader.addEventListener('click', function() {
                // Si les détails sont cachés, les afficher
                if (monthDetailsContainer.classList.contains('hidden')) {
                    // Grouper les jours
                    const dayGroups = groupOrdersByDay(monthGroups[monthKey]);
                    
                    monthDetailsContainer.innerHTML = '';
                    Object.keys(dayGroups).forEach(dayKey => {
                        const dayContainer = document.createElement('div');
                        dayContainer.className = 'day-group';
                        
                        const dayHeader = document.createElement('div');
                        dayHeader.className = 'day-header';
                        dayHeader.textContent = dayKey;
                        
                        // Nombre de commandes pour ce jour
                        const dayOrderCount = dayGroups[dayKey].length;
                        const dayOrderBadge = document.createElement('span');
                        dayOrderBadge.className = 'day-order-count';
                        dayOrderBadge.textContent = dayOrderCount;
                        dayHeader.appendChild(dayOrderBadge);
                        
                        dayContainer.appendChild(dayHeader);
                        
                        // Zone pour les détails du jour (initialement cachée)
                        const dayDetailsContainer = document.createElement('div');
                        dayDetailsContainer.className = 'day-details hidden';
                        dayContainer.appendChild(dayDetailsContainer);
                        
                        // Événement pour développer/réduire le jour
                        dayHeader.addEventListener('click', function() {
                            // Basculer la visibilité des détails du jour
                            if (dayDetailsContainer.classList.contains('hidden')) {
                                // Afficher les commandes de ce jour
                                dayDetailsContainer.innerHTML = '';
                                dayGroups[dayKey].forEach(order => {
                                    const orderEl = createOrderElement(order);
                                    dayDetailsContainer.appendChild(orderEl);
                                });
                                
                                dayDetailsContainer.classList.remove('hidden');
                                dayHeader.classList.add('expanded');
                            } else {
                                dayDetailsContainer.innerHTML = '';
                                dayDetailsContainer.classList.add('hidden');
                                dayHeader.classList.remove('expanded');
                            }
                        });
                        
                        monthDetailsContainer.appendChild(dayContainer);
                    });
                    
                    monthDetailsContainer.classList.remove('hidden');
                    monthHeader.classList.add('expanded');
                } else {
                    // Réduire les détails
                    monthDetailsContainer.innerHTML = '';
                    monthDetailsContainer.classList.add('hidden');
                    monthHeader.classList.remove('expanded');
                }
            });
            
            historyOrderList.appendChild(monthContainer);
        });
    }

    // Fonction pour créer un élément de commande (identique à la fonction existante displayHistoryOrders)
    function createOrderElement(order) {
        const orderDate = formatDate(order.date);
        const processDate = formatDate(order.lastProcessed);
        
        // Calculer le nombre total d'articles livrés
        const totalDeliveredItems = order.deliveredItems 
            ? order.deliveredItems.reduce((sum, item) => sum + item.quantity, 0)
            : 0;
        
        // Récupérer les 3 premiers noms d'articles pour l'aperçu
        const itemsPreview = (order.deliveredItems || []).slice(0, 3).map(item => {
            const shortName = item.Nom.split(' - ')[0];
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
                    <i class="fas fa-clipboard-check"></i>
                    Commande #${order.orderId}
                </div>
                <div class="order-date">
                    Commandée le: ${orderDate}<br>
                    Traitée le: ${processDate}
                </div>
                <div class="customer-info">
                    <div class="customer-name">${customerName}</div>
                    <div class="customer-shop">Boutique: ${shopName}</div>
                    <div class="customer-contact">Email: ${email} | Tél: ${phone}</div>
                </div>
                <div class="order-items">
                    <div class="item-count">${totalDeliveredItems} article${totalDeliveredItems > 1 ? 's' : ''} livré${totalDeliveredItems > 1 ? 's' : ''}</div>
                    <div class="items-preview">${itemsPreview}${(order.deliveredItems || []).length > 3 ? '...' : ''}</div>
                </div>
            </div>
            <div class="order-actions">
                <button class="action-btn view-btn" data-order-id="${order.orderId}" data-user-id="${order.userId}">
                    <i class="fas fa-eye"></i> Voir détails
                </button>
                <a href="/api/admin/download-invoice/${order.orderId}/${order.userId}" class="action-btn download-btn" target="_blank">
                    <i class="fas fa-file-pdf"></i> Facture
                </a>
            </div>
        `;
        
        // Ajouter l'écouteur d'événement pour le bouton de visualisation
        const viewButton = orderItem.querySelector('.view-btn');
        viewButton.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            const userId = this.getAttribute('data-user-id');
            viewOrderDetails(orderId, userId);
        });
        
        return orderItem;
    }

    // Fonction pour charger les commandes traitées depuis l'API
    function loadTreatedOrders() {
        historyOrderList.innerHTML = `
            <div class="loading">Chargement de l'historique des commandes...</div>
        `;
        
        fetch('/api/admin/treated-orders')
            .then(response => response.json())
            .then(orders => {
                // Stocker toutes les commandes pour la recherche
                allTreatedOrders = orders;
                displayHierarchicalOrders(orders);
            })
            .catch(error => {
                console.error('Erreur lors du chargement de l\'historique des commandes:', error);
                historyOrderList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erreur lors du chargement de l'historique des commandes. Veuillez réessayer.</p>
                        <button class="action-btn" onclick="loadTreatedOrders()">Réessayer</button>
                    </div>
                `;
            });
    }
    
    // Le reste de votre code existant... (recherche, détails de commande, etc.)
    
    // Fonction pour rechercher des commandes
    function searchOrders() {
        const searchValue = searchOrderInput.value.toLowerCase().trim();
        
        if (!searchValue) {
            displayHierarchicalOrders(allTreatedOrders);
            return;
        }
        
        // Afficher une indication de recherche
        historyOrderList.innerHTML = `
            <div class="loading">Recherche en cours...</div>
        `;
        
        // Filtrer les commandes
        const filteredOrders = allTreatedOrders.filter(order => {
            // Recherche par ID de commande
            if (order.orderId.toLowerCase().includes(searchValue)) return true;
            
            // Recherche par ID client
            if (order.userId.toLowerCase().includes(searchValue)) return true;
            
            // Recherche par infos client
            const userProfile = order.userProfile || {};
            const fullName = (userProfile.fullName || '').toLowerCase();
            const shopName = (userProfile.shopName || '').toLowerCase();
            const email = (userProfile.email || '').toLowerCase();
            const phone = (userProfile.phone || '').toLowerCase();
            
            // Recherche par articles
            const hasMatchingItem = (order.deliveredItems || []).some(item => 
                (item.Nom || '').toLowerCase().includes(searchValue)
            );
            
            return fullName.includes(searchValue) || 
                   shopName.includes(searchValue) || 
                   email.includes(searchValue) || 
                   phone.includes(searchValue) ||
                   hasMatchingItem;
        });
        
        displayHierarchicalOrders(filteredOrders);
        
        // Afficher un message indiquant les résultats de recherche
        if (filteredOrders.length > 0) {
            showNotification(`${filteredOrders.length} commande(s) trouvée(s) pour "${searchValue}"`, 'info');
        } else {
            showNotification(`Aucune commande trouvée pour "${searchValue}"`, 'info');
        }
    }
    
    // Reste de votre code existant pour les détails de commande, notifications, etc.
    function viewOrderDetails(orderId, userId) {
        orderDetailsContent.innerHTML = `<div class="loading">Chargement des détails...</div>`;
        orderModal.style.display = 'block';
        
        fetch(`/api/admin/order-details/${orderId}/${userId}`)
            .then(response => response.json())
            .then(orderDetails => {
                displayOrderDetails(orderDetails);
            })
            .catch(error => {
                console.error('Erreur lors du chargement des détails de la commande:', error);
                orderDetailsContent.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Erreur lors du chargement des détails de la commande.</p>
                    </div>
                `;
            });
    }

    function displayOrderDetails(order) {
        const orderDate = formatDate(order.date);
        
        // Calculer le montant total uniquement pour les articles livrés
        const totalAmount = (order.deliveredItems || []).reduce((total, item) => {
            return total + (parseFloat(item.prix) * item.quantity);
        }, 0).toFixed(2);
    
        // Statut de la commande (avec option "partiellement livrée" si applicable)
        let statusText = 'COMPLETED';
        let statusClass = 'partially-shipped';
        
        if (order.remainingItems && order.remainingItems.length > 0) {
            statusText = 'PARTIALLY SHIPPED';
        }
        
        // Créer le HTML pour le contenu de la modal
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
                        ${(order.deliveredItems || []).map(item => `
                            <tr>
                                <td class="qty-column">${item.quantity}</td>
                                <td class="product-column">
                                    <span class="product-name">${item.Nom}</span>
                                </td>
                                <td class="unit-price-column">${parseFloat(item.prix).toFixed(2)} CHF</td>
                                <td class="total-column">${(parseFloat(item.prix) * item.quantity).toFixed(2)} CHF</td>
                            </tr>
                        `).join('')}
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
                            ${order.remainingItems.map(item => `
                                <tr>
                                    <td class="qty-column">${item.quantity}</td>
                                    <td class="product-column">
                                        <span class="product-name">${item.Nom}</span>
                                    </td>
                                    <td class="unit-price-column">-</td>
                                    <td class="total-column">-</td>
                                </tr>
                            `).join('')}
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
                <a href="/api/admin/download-invoice/${order.orderId}/${order.userId}" 
                   class="download-invoice-btn" 
                   target="_blank">
                    <i class="fas fa-file-pdf"></i> Télécharger la Facture
                </a>
            </div>
        `;
        
        // Mettre à jour le contenu de la modal
        orderDetailsContent.innerHTML = detailsHTML;
    }
    
    function showNotification(message, type = 'success') {
        // Votre code existant pour les notifications
    }
    
    // Écouteurs d'événements
    if (searchOrderBtn) {
        searchOrderBtn.addEventListener('click', searchOrders);
    }
    
    if (searchOrderInput) {
        searchOrderInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                searchOrders();
            }
        });
    }
    
    // Fermeture de la modal
    closeModal.addEventListener('click', function() {
        orderModal.style.display = 'none';
    });
    
    window.addEventListener('click', function(event) {
        if (event.target === orderModal) {
            orderModal.style.display = 'none';
        }
    });
});