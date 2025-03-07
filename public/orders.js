document.addEventListener('DOMContentLoaded', function() {
    // Référence aux éléments
    const pendingDeliveriesBtn = document.getElementById('pendingDeliveriesBtn');
    const pendingDeliveriesContainer = document.getElementById('pendingDeliveriesContainer');
    const pendingItemsCount = document.getElementById('pendingItemsCount');
    const ordersContainer = document.getElementById('ordersList');
    
    // Variable pour stocker l'ordre des articles en attente
    let pendingDeliveryOrder = null;
    
    // Fonction pour basculer l'affichage des articles en attente
    function togglePendingDeliveries() {
        const isVisible = pendingDeliveriesContainer.classList.contains('visible');
        
        if (isVisible) {
            // Cacher
            pendingDeliveriesContainer.classList.remove('visible');
            setTimeout(() => {
                pendingDeliveriesContainer.style.display = 'none';
            }, 300); // Attendre la fin de l'animation
            
            // Changer le texte du bouton
            pendingDeliveriesBtn.innerHTML = `
                <i class="fas fa-truck"></i> Voir les articles en attente de livraison
                <span id="pendingItemsCount" class="pending-items-count">${pendingItemsCount.textContent}</span>
            `;
        } else {
            // Afficher
            pendingDeliveriesContainer.style.display = 'block';
            
            // Déclencher le reflow pour que l'animation fonctionne
            void pendingDeliveriesContainer.offsetWidth;
            
            pendingDeliveriesContainer.classList.add('visible');
            
            // Changer le texte du bouton
            pendingDeliveriesBtn.innerHTML = `
                <i class="fas fa-chevron-up"></i> Masquer les articles en attente de livraison
                <span id="pendingItemsCount" class="pending-items-count">${pendingItemsCount.textContent}</span>
            `;
        }
    }
    
    // Ajouter l'écouteur d'événement au bouton
    if (pendingDeliveriesBtn) {
        pendingDeliveriesBtn.addEventListener('click', togglePendingDeliveries);
    }
    
    // Afficher un message de chargement avec un style plus doux
    ordersContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading your orders...</p>
        </div>
    `;

    function getStatusClass(status) {
        switch(status) {
            case 'shipped':
            case 'completed':
            case 'delivered':
                return 'status-shipped';
            case 'partial':
                return 'status-partial';
            case 'pending-delivery':
                return 'status-processing';
            case 'in progress':
            case 'pending':
            default:
                return 'status-processing';
        }
    }

    function getReadableStatus(status) {
        switch(status) {
            case 'in progress':
            case 'pending':
                return 'Processing';
            case 'shipped':
            case 'completed':
            case 'delivered':
                return 'Completed';
            case 'partial':
                return 'Completed';
            case 'pending-delivery':
                return 'Pending Delivery';
            default:
                return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
        }
    }

    // Fonction pour afficher les articles en attente de livraison
    function displayPendingDeliveryItems(order) {
        // Récupérer les articles en attente de livraison
        const toDeliverItems = order.items || [];
        const groupedItems = order.groupedItems || {};
        
        // Créer la carte de commande en attente
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card pending-delivery-card';
        
        // En-tête spécial pour les articles en attente
        orderCard.innerHTML = `
            <div class="order-card-header">
                <h3>Pending Delivery Items</h3>
                <span class="order-status status-processing">
                    Pending Delivery
                </span>
            </div>
            <div class="order-date">Items waiting to be delivered from previous orders</div>
        `;
        
        // S'il y a des articles groupés par catégorie
        if (Object.keys(groupedItems).length > 0) {
            // Pour chaque catégorie
            for (const category in groupedItems) {
                // Créer une section pour la catégorie
                const categorySection = document.createElement('div');
                categorySection.className = 'category-section';
                
                // Entête de la catégorie
                categorySection.innerHTML = `
                    <h4 class="category-header">${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                    <table class="order-details-table">
                        <thead>
                            <tr>
                                <th class="qty-column">Qty</th>
                                <th class="product-name-column">Product</th>
                                <th class="unit-price-column">Unit Price</th>
                                <th class="total-price-column">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${groupedItems[category].map(item => {
                                const itemTotal = parseFloat(item.prix) * item.quantity;
                                return `
                                    <tr class="pending-item">
                                        <td class="qty-column">${item.quantity}</td>
                                        <td class="product-name-column">${item.Nom}</td>
                                        <td class="unit-price-column">${parseFloat(item.prix).toFixed(2)} CHF</td>
                                        <td class="total-price-column">${itemTotal.toFixed(2)} CHF</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
                
                orderCard.appendChild(categorySection);
            }
        } else {
            // Affichage simple sans catégories
            const itemsTable = document.createElement('div');
            itemsTable.innerHTML = `
                <table class="order-details-table">
                    <thead>
                        <tr>
                            <th class="qty-column">Qty</th>
                            <th class="product-name-column">Product</th>
                            <th class="unit-price-column">Unit Price</th>
                            <th class="total-price-column">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${toDeliverItems.map(item => {
                            const itemTotal = parseFloat(item.prix) * item.quantity;
                            return `
                                <tr class="pending-item">
                                    <td class="qty-column">${item.quantity}</td>
                                    <td class="product-name-column">${item.Nom}</td>
                                    <td class="unit-price-column">${parseFloat(item.prix).toFixed(2)} CHF</td>
                                    <td class="total-price-column">${itemTotal.toFixed(2)} CHF</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
            
            orderCard.appendChild(itemsTable);
        }
        
        // Calcul du montant total en attente
        const totalAmount = toDeliverItems.reduce((total, item) => 
            total + (parseFloat(item.prix) * item.quantity), 0
        ).toFixed(2);
        
        // Ajouter le total
        const totalSection = document.createElement('div');
        totalSection.className = 'order-summary';
        totalSection.innerHTML = `
            <div class="order-summary-total">
                Total Pending: ${totalAmount} CHF
                <span class="invoice-not-available">
                    <i class="fas fa-info-circle"></i> These items will be delivered when available
                </span>
            </div>
        `;
        
        orderCard.appendChild(totalSection);
        
        return orderCard;
    }

    fetch('/api/user-orders')
        .then(response => response.json())
        .then(orders => {
            // Vider le conteneur
            ordersContainer.innerHTML = '';
            
            if (orders.length === 0) {
                ordersContainer.innerHTML = '<p class="no-orders-message">You have no orders yet.</p>';
                return;
            }

            // Rechercher les articles en attente de livraison
            pendingDeliveryOrder = orders.find(order => order.isToDeliverItems);
            
            // Mettre à jour le compteur et le style du bouton si des articles sont en attente
            if (pendingDeliveryOrder) {
                // Calculer le nombre total d'articles en attente
                const pendingItemsTotal = pendingDeliveryOrder.items.reduce((total, item) => total + item.quantity, 0);
                
                // Mettre à jour le compteur
                pendingItemsCount.textContent = pendingItemsTotal;
                pendingItemsCount.classList.remove('hidden');
                
                // Ajouter la classe pour l'animation si des articles sont en attente
                pendingDeliveriesBtn.classList.add('has-items');
                
                // Remplir le conteneur des articles en attente
                pendingDeliveriesContainer.innerHTML = '';
                const pendingDeliveryCard = displayPendingDeliveryItems(pendingDeliveryOrder);
                pendingDeliveriesContainer.appendChild(pendingDeliveryCard);
                
                // Retirer cet élément spécial de la liste des commandes
                orders = orders.filter(order => !order.isToDeliverItems);
            } else {
                // Cacher le compteur s'il n'y a pas d'articles en attente
                pendingItemsCount.classList.add('hidden');
                pendingDeliveriesBtn.classList.remove('has-items');
            }
            
            // Trier les commandes de la plus récente à la plus ancienne
            orders.sort((a, b) => new Date(b.date) - new Date(a.date));

            orders.forEach((order, index) => {
                // Si c'est une commande spéciale d'articles en attente, on ne l'affiche pas ici
                if (order.isToDeliverItems) return;
                
                const orderDate = new Date(order.date).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });

                // Calcul du montant total initial
                const initialTotalAmount = order.items.reduce((total, item) => 
                    total + (parseFloat(item.prix) * item.quantity), 0
                ).toFixed(2);

                // Calcul du montant total des articles livrés uniquement
                let deliveredTotalAmount = initialTotalAmount;
                if (order.status === 'partial' && order.deliveredItems) {
                    deliveredTotalAmount = order.deliveredItems.reduce((total, item) => 
                        total + (parseFloat(item.prix) * item.quantity), 0
                    ).toFixed(2);
                }

                // Créer le contenu de la commande avec un tableau détaillé
                const orderCard = document.createElement('div');
                orderCard.className = 'order-card';
                
                // HTML pour la carte de commande
                let orderHtml = `
                    <div class="order-card-header">
                        <h3>Order #${orders.length - index}</h3>
                        <span class="order-status ${getStatusClass(order.status)}">
                            ${getReadableStatus(order.status)}
                        </span>
                    </div>
                    <div class="order-date">${orderDate}</div>
                    
                    <table class="order-details-table">
                        <thead>
                            <tr>
                                <th class="qty-column">Qty</th>
                                <th class="product-name-column">Product</th>
                                <th class="unit-price-column">Unit Price</th>
                                <th class="total-price-column">Total</th>
                            </tr>
                        </thead>
                        <tbody>`;
                
                // Pour les commandes partiellement livrées, afficher les articles déjà livrés
                if (order.status === 'partial' && order.deliveredItems && order.deliveredItems.length > 0) {
                    
                    order.deliveredItems.forEach(item => {
                        const itemTotal = parseFloat(item.prix) * item.quantity;
                        
                        orderHtml += `
                            <tr class="delivered-item">
                                <td class="qty-column">${item.quantity}</td>
                                <td class="product-name-column">${item.Nom}</td>
                                <td class="unit-price-column">${parseFloat(item.prix).toFixed(2)} CHF</td>
                                <td class="total-price-column">${itemTotal.toFixed(2)} CHF</td>
                            </tr>`;
                    });
                    
                    // Ajouter une section pour les articles restants à livrer
                    if (order.remainingItems && order.remainingItems.length > 0) {
                        orderHtml += `
                            <tr class="order-section-header">
                                <td colspan="4" class="pending-section">PENDING ITEMS</td>
                            </tr>`;
                        
                        order.remainingItems.forEach(item => {
                            orderHtml += `
                                <tr class="pending-item">
                                    <td class="qty-column">${item.quantity}</td>
                                    <td class="product-name-column">${item.Nom}</td>
                                    <td class="unit-price-column">-</td>
                                    <td class="total-price-column">-</td>
                                </tr>`;
                        });
                    }
                } else {
                    // Pour les commandes normales ou complètes, afficher tous les articles
                    order.items.forEach(item => {
                        const itemTotal = parseFloat(item.prix) * item.quantity;
                        
                        orderHtml += `
                            <tr>
                                <td class="qty-column">${item.quantity}</td>
                                <td class="product-name-column">${item.Nom}</td>
                                <td class="unit-price-column">${parseFloat(item.prix).toFixed(2)} CHF</td>
                                <td class="total-price-column">${itemTotal.toFixed(2)} CHF</td>
                            </tr>`;
                    });
                }
                
                orderHtml += `
                        </tbody>
                    </table>
                    
                    <div class="order-summary">
                        <div class="order-summary-total">
                            Total: ${order.status === 'partial' ? deliveredTotalAmount : initialTotalAmount} CHF
                            ${order.status !== 'pending' && order.status !== 'in progress' ? 
                                `<button class="download-invoice-btn" data-order-id="${order.orderId || index}">
                                    <i class="fas fa-file-pdf"></i> Download Invoice
                                </button>` : 
                                `<span class="invoice-not-available">
                                    <i class="fas fa-info-circle"></i> Invoice will be available after delivery
                                </span>`
                            }
                        </div>
                    </div>
                `;
                
                orderCard.innerHTML = orderHtml;
                ordersContainer.appendChild(orderCard);
            });

            // Ajouter les écouteurs d'événements pour les boutons de téléchargement
            document.querySelectorAll('.download-invoice-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const orderIdOrIndex = this.getAttribute('data-order-id');
                    window.open(`/api/download-invoice/${orderIdOrIndex}`, '_blank');
                });
            });
        })
        .catch(error => {
            console.error('Error:', error);
            ordersContainer.innerHTML = 
                '<p class="error-message">Error loading orders. Please try again later.</p>';
        });
});