/**
 * Module de filtrage de produits
 * Gère les filtres de catégorie dans le catalogue
 */

import { AppConfig } from '../../core/config.js';

/**
 * Initialise les filtres de catégorie
 * @param {Function} filterCallback - Fonction à appeler pour filtrer les produits
 */
export function initProductFilter(filterCallback) {
    // Initialiser le filtre de catégorie (menu déroulant)
    setupCategoryMenuItems(filterCallback);
    
    // Initialiser le filtre de catégorie (select caché)
    setupCategorySelect(filterCallback);
}

/**
 * Configure les éléments de catégorie dans le menu déroulant
 * @param {Function} filterCallback - Fonction à appeler pour filtrer les produits
 */
function setupCategoryMenuItems(filterCallback) {
    const categoryItems = document.querySelectorAll('.category-item');
    
    categoryItems.forEach(item => {
        item.addEventListener('click', function() {
            // Récupérer la catégorie sélectionnée
            const category = this.getAttribute('data-category');
            
            // Mettre à jour l'interface
            updateCategoryUI(category, categoryItems);
            
            // Appeler le callback pour filtrer les produits
            if (typeof filterCallback === 'function') {
                filterCallback(category);
            }
            
            // Fermer le menu après la sélection
            const dropdownMenu = document.getElementById('dropdownMenu');
            const menuOverlay = document.getElementById('menuOverlay');
            
            if (dropdownMenu) {
                dropdownMenu.classList.remove('open');
            }
            
            if (menuOverlay) {
                menuOverlay.classList.remove('active');
            }
        });
    });
}

/**
 * Configure le select caché pour compatibilité avec le code existant
 * @param {Function} filterCallback - Fonction à appeler pour filtrer les produits
 */
function setupCategorySelect(filterCallback) {
    const categoryFilter = document.getElementById('categoryFilter');
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', function() {
            const category = this.value;
            
            // Mettre à jour l'interface
            updateCategoryUI(category);
            
            // Appeler le callback pour filtrer les produits
            if (typeof filterCallback === 'function') {
                filterCallback(category);
            }
        });
    }
}

/**
 * Met à jour l'interface utilisateur pour refléter la catégorie sélectionnée
 * @param {string} category - Catégorie sélectionnée
 * @param {NodeList} categoryItems - Éléments de catégorie dans le menu
 */
function updateCategoryUI(category, categoryItems = null) {
    // Mettre à jour le select caché
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.value = category;
    }
    
    // Mettre à jour les éléments du menu si fournis
    if (categoryItems) {
        categoryItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-category') === category) {
                item.classList.add('active');
            }
        });
    } else {
        // Sinon, chercher les éléments
        const items = document.querySelectorAll('.category-item');
        items.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-category') === category) {
                item.classList.add('active');
            }
        });
    }
}

/**
 * Récupère les catégories disponibles
 * @returns {Array} Liste des catégories
 */
export function getAvailableCategories() {
    return AppConfig.PRODUCT_CATEGORIES || [
        { id: 'all', name: 'All Products' },
        { id: 'magnet', name: 'Magnets' },
        { id: 'keyring', name: 'Keyrings' },
        { id: 'pens', name: 'Pens' },
        { id: 'bags', name: 'Bags' },
        { id: 'hats', name: 'Hats' },
        { id: 'caps', name: 'Caps' },
        { id: 'bells', name: 'Bells' },
        { id: 'softtoy', name: 'Soft-Toys' },
        { id: 'tshirt', name: 'T-Shirts' },
        { id: 'lighter', name: 'Lighters' },
        { id: 'gadget', name: 'Gadgets' }
    ];
}

/**
 * Récupère la catégorie actuellement sélectionnée
 * @returns {string} ID de la catégorie active
 */
export function getCurrentCategory() {
    // Vérifier le select caché d'abord
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        return categoryFilter.value;
    }
    
    // Sinon, vérifier les éléments du menu
    const activeItem = document.querySelector('.category-item.active');
    if (activeItem) {
        return activeItem.getAttribute('data-category');
    }
    
    // Par défaut, retourner "all"
    return 'all';
}