/**
 * Gestion de l'affichage de l'historique des commandes
 * Ce module gère le chargement et l'affichage hiérarchique des commandes traitées
 */

import * as API from '../../core/api.js';
import * as Notification from '../../utils/notification.js';
import * as Formatter from '../../utils/formatter.js';
import * as HistoryView from './historyView.js';

// Référence DOM
let historyOrderList;
let searchInput;
let searchBtn;

// Variable de stockage pour filtrage
let allTreatedOrders = [];

/**
 * Charge les commandes traitées depuis l'API
 */
async function loadTreatedOrders() {
    // Obtenir les références DOM
    historyOrderList = document.getElementById('historyOrderList');
    searchInput = document.getElementById('searchOrderInput');
    searchBtn = document.getElementById('searchOrderBtn');
    
    if (!historyOrderList) {
        console.error("Conteneur d'historique non trouvé");
        return;
    }
    
    // Afficher l'indicateur de chargement
    historyOrderList.innerHTML = `
        <div class="loading">Chargement de l'historique des commandes...</div>
    `;
    
    try {
        // Appel API pour récupérer les commandes traitées
        const orders = await API.fetchTreatedOrders();
        
        // Stocker toutes les commandes pour la recherche
        allTreatedOrders = orders;
        
        // Afficher les commandes groupées
        displayHierarchicalOrders(orders);
        
        // Initialiser les événements de recherche
        initSearchEvents();
    } catch (error) {
        console.error('Erreur lors du chargement de l\'historique des commandes:', error);
        
        // Afficher un message d'erreur avec bouton de réessai
        historyOrderList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erreur lors du chargement de l'historique des commandes. Veuillez réessayer.</p>
                <button class="action-btn" id="retryLoadHistory">Réessayer</button>
            </div>
        `;
        
        // Ajouter l'écouteur pour le bouton de réessai
        const retryButton = document.getElementById('retryLoadHistory');
        if (retryButton) {
            retryButton.addEventListener('click', loadTreatedOrders);
        }
    }
}

/**
 * Groupe les commandes par mois
 * @param {Array} orders - Liste des commandes
 * @returns {Object} Commandes groupées par mois
 */
function groupOrdersByMonth(orders) {
    const monthGroups = {};
    
    orders.forEach(order => {
        const orderDate = new Date(order.lastProcessed || order.date);
        const monthKey = Formatter.formatDate(orderDate, { year: 'numeric', month: 'long' });
        
        if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = [];
        }
        
        monthGroups[monthKey].push(order);
    });
    
    return monthGroups;
}

/**
 * Groupe les commandes par jour
 * @param {Array} monthOrders - Liste des commandes d'un mois
 * @returns {Object} Commandes groupées par jour
 */
function groupOrdersByDay(monthOrders) {
    const dayGroups = {};
    
    monthOrders.forEach(order => {
        const orderDate = new Date(order.lastProcessed || order.date);
        const dayKey = Formatter.formatDate(orderDate, { 
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

/**
 * Affiche les commandes de manière hiérarchique (par mois puis par jour)
 * @param {Array} orders - Liste des commandes à afficher
 */
function displayHierarchicalOrders(orders) {
    // Vérifier s'il y a des commandes
    if (!orders || orders.length === 0) {
        historyOrderList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>Aucune commande traitée trouvée.</p>
            </div>
        `;
        return;
    }
    
    // Vider le conteneur
    historyOrderList.innerHTML = '';
    
    // Grouper par mois
    const monthGroups = groupOrdersByMonth(orders);
    
    // Créer une section pour chaque mois
    Object.keys(monthGroups).forEach(monthKey => {
        const monthContainer = document.createElement('div');
        monthContainer.className = 'month-group';
        
        // Créer l'en-tête du mois
        const monthHeader = document.createElement('div');
        monthHeader.className = 'month-header';
        monthHeader.setAttribute('data-month', monthKey);
        monthHeader.textContent = monthKey;
        
        // Badge avec nombre de commandes
        const monthOrderCount = monthGroups[monthKey].length;
        const monthOrderBadge = document.createElement('span');
        monthOrderBadge.className = 'month-order-count';
        monthOrderBadge.textContent = monthOrderCount;
        monthHeader.appendChild(monthOrderBadge);
        
        monthContainer.appendChild(monthHeader);
        
        // Conteneur pour les détails du mois (masqué initialement)
        const monthDetailsContainer = document.createElement('div');
        monthDetailsContainer.className = 'month-details hidden';
        monthContainer.appendChild(monthDetailsContainer);
        
        // Ajouter des écouteurs pour développer/réduire le mois
        monthHeader.addEventListener('click', function() {
            toggleMonthDetails(this, monthDetailsContainer, monthGroups[monthKey]);
        });
        
        // Ajouter le conteneur du mois au conteneur principal
        historyOrderList.appendChild(monthContainer);
    });
}

/**
 * Affiche/masque les détails d'un mois
 * @param {HTMLElement} header - En-tête du mois
 * @param {HTMLElement} container - Conteneur des détails
 * @param {Array} monthOrders - Commandes du mois
 */
function toggleMonthDetails(header, container, monthOrders) {
    const isHidden = container.classList.contains('hidden');
    
    if (isHidden) {
        // Afficher les détails (groupés par jour)
        const dayGroups = groupOrdersByDay(monthOrders);
        
        container.innerHTML = '';
        
        // Créer une section pour chaque jour
        Object.keys(dayGroups).forEach(dayKey => {
            const dayContainer = document.createElement('div');
            dayContainer.className = 'day-group';
            
            // Créer l'en-tête du jour
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = dayKey;
            
            // Badge avec nombre de commandes pour ce jour
            const dayOrderCount = dayGroups[dayKey].length;
            const dayOrderBadge = document.createElement('span');
            dayOrderBadge.className = 'day-order-count';
            dayOrderBadge.textContent = dayOrderCount;
            dayHeader.appendChild(dayOrderBadge);
            
            dayContainer.appendChild(dayHeader);
            
            // Conteneur pour les détails du jour (masqué initialement)
            const dayDetailsContainer = document.createElement('div');
            dayDetailsContainer.className = 'day-details hidden';
            dayContainer.appendChild(dayDetailsContainer);
            
            // Ajouter des écouteurs pour développer/réduire le jour
            dayHeader.addEventListener('click', function(event) {
                event.stopPropagation(); // Empêcher de déclencher le clic du mois
                toggleDayDetails(this, dayDetailsContainer, dayGroups[dayKey]);
            });
            
            // Ajouter le conteneur du jour au conteneur du mois
            container.appendChild(dayContainer);
        });
        
        // Afficher le conteneur et mettre en évidence l'en-tête
        container.classList.remove('hidden');
        header.classList.add('expanded');
    } else {
        // Masquer les détails
        container.innerHTML = '';
        container.classList.add('hidden');
        header.classList.remove('expanded');
    }
}

/**
 * Affiche/masque les détails d'un jour
 * @param {HTMLElement} header - En-tête du jour
 * @param {HTMLElement} container - Conteneur des détails
 * @param {Array} dayOrders - Commandes du jour
 */
function toggleDayDetails(header, container, dayOrders) {
    const isHidden = container.classList.contains('hidden');
    
    if (isHidden) {
        // Afficher les commandes de ce jour
        container.innerHTML = '';
        
        // Créer un élément pour chaque commande du jour
        dayOrders.forEach(order => {
            const orderElement = createOrderElement(order);
            container.appendChild(orderElement);
        });
        
        // Afficher le conteneur et mettre en évidence l'en-tête
        container.classList.remove('hidden');
        header.classList.add('expanded');
    } else {
        // Masquer les détails
        container.innerHTML = '';
        container.classList.add('hidden');
        header.classList.remove('expanded');
    }
}

/**
 * Crée un élément HTML pour une commande
 * @param {Object} order - Données de la commande
 * @returns {HTMLElement} Élément de commande
 */
function createOrderElement(order) {
    const orderDate = Formatter.formatDate(order.date);
    const processDate = Formatter.formatDate(order.lastProcessed);
    
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
    
    // Créer l'élément de commande
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
            <a href="${API.getInvoiceDownloadLink(order.orderId, order.userId)}" class="action-btn download-btn" target="_blank">
                <i class="fas fa-file-pdf"></i> Facture
            </a>
        </div>
    `;
    
    // Ajouter l'écouteur d'événement pour le bouton de visualisation
    const viewButton = orderItem.querySelector('.view-btn');
    viewButton.addEventListener('click', function() {
        const orderId = this.getAttribute('data-order-id');
        const userId = this.getAttribute('data-user-id');
        HistoryView.viewOrderDetails(orderId, userId);
    });
    
    return orderItem;
}

/**
 * Initialise les événements de recherche
 */
function initSearchEvents() {
    if (searchBtn) {
        searchBtn.addEventListener('click', searchOrders);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                searchOrders();
            }
        });
    }
}

/**
 * Effectue une recherche dans les commandes
 */
function searchOrders() {
    const searchValue = searchInput.value.toLowerCase().trim();
    
    if (!searchValue) {
        // Si la recherche est vide, afficher toutes les commandes
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
    
    // Afficher les commandes filtrées
    displayHierarchicalOrders(filteredOrders);
    
    // Afficher un message indiquant les résultats de recherche
    if (filteredOrders.length > 0) {
        Notification.showNotification(`${filteredOrders.length} commande(s) trouvée(s) pour "${searchValue}"`, 'info');
    } else {
        Notification.showNotification(`Aucune commande trouvée pour "${searchValue}"`, 'info');
    }
}

// Exposer les fonctions publiques
export {
    loadTreatedOrders,
    displayHierarchicalOrders,
    createOrderElement,
    searchOrders
};