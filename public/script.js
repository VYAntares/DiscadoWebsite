async function fetchProducts() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        return products;
    } catch (error) {
        console.error("Erreur lors de la récupération des produits:", error);
        return [];
    }
}

// Fonction pour afficher une notification
function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container');
    
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
        <div class="notification-progress">
            <div class="notification-progress-bar"></div>
        </div>
    `;
    
    // Ajouter au conteneur
    container.appendChild(notification);
    
    // Supprimer après l'animation
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

function displayProducts(products, category = "all") {
    const list = document.getElementById("productList");
    list.innerHTML = "";

    products
        .filter(p => category === "all" || p.categorie === category)
        .filter(p => p.Nom && p.Nom.trim() !== "")
        .forEach(p => {
            // Vérifier si les propriétés essentielles existent, sinon utiliser des valeurs par défaut
            const productName = p.Nom || "Produit sans nom";
            const productPrice = p.prix || "0.00";
            const productCategory = p.categorie || "default";
            const productImage = p.imageUrl || `/images/${productCategory}/${productCategory}-default.jpg`;

            const li = document.createElement("li");
            li.className = "product-item";

            // Image du produit
            const imgContainer = document.createElement("div");
            imgContainer.className = "product-img-container";
            
            const img = document.createElement("img");
            img.src = productImage;
            img.alt = productName;
            img.className = "product-img";
            
            // Gestion plus robuste des erreurs d'images
            img.onerror = function() {
                console.log(`Image non trouvée: ${this.src}`);
                // Essayer d'abord avec un chemin sans /public
                if (this.src.includes('/public/')) {
                    this.src = this.src.replace('/public/', '/');
                    return;
                }
                
                // Fallback vers une image par défaut en cas d'erreur
                this.src = `/images/${productCategory}/${productCategory}-default.jpg`;
                
                // Deuxième fallback si l'image par défaut de catégorie n'existe pas
                this.onerror = function() {
                    this.src = '/images/product-default.jpg';
                    // Éviter les boucles infinies
                    this.onerror = null;
                };
            };
            
            imgContainer.appendChild(img);

            // Conteneur d'informations (nom et prix)
            const infoContainer = document.createElement("div");
            infoContainer.className = "product-info";

            // Nom du produit
            const nameSpan = document.createElement("span");
            nameSpan.textContent = productName;
            nameSpan.className = "product-name";

            // Prix du produit
            const priceSpan = document.createElement("span");
            priceSpan.textContent = `${productPrice} CHF`;
            priceSpan.className = "product-price";

            infoContainer.appendChild(nameSpan);
            infoContainer.appendChild(priceSpan);

            // Conteneur pour le compteur et le bouton
            const actionContainer = document.createElement("div");
            actionContainer.className = "product-actions";

            // Trouve cette section dans ton fichier script.js, dans la fonction displayProducts
            // Remplace le code qui crée les boutons de quantité par celui-ci:

            // Compteur de quantité
            const quantityContainer = document.createElement("div");
            quantityContainer.className = "quantity-container";

            // Bouton moins
            const minusBtn = document.createElement("button");
            minusBtn.textContent = "−"; // Utiliser un tiret un peu plus élégant
            minusBtn.className = "quantity-btn minus-btn";
            minusBtn.onclick = function() {
                const input = this.parentNode.querySelector('input');
                const value = parseInt(input.value);
                if (value > 0) {
                    input.value = value - 1;
                }
            };

            // Input pour la quantité
            const quantityInput = document.createElement("input");
            quantityInput.type = "number";
            quantityInput.min = "0";
            quantityInput.value = "0";
            quantityInput.className = "quantity-input";
            // Permettre l'ajout au panier avec Enter
            quantityInput.addEventListener('keyup', function(event) {
                if (event.key === 'Enter') {
                    const addBtn = this.closest('.product-actions').querySelector('.add-to-cart-btn');
                    if (addBtn) {
                        addBtn.click();
                    }
                }
            });

            // Bouton plus
            const plusBtn = document.createElement("button");
            plusBtn.textContent = "+";
            plusBtn.className = "quantity-btn plus-btn";
            plusBtn.onclick = function() {
                const input = this.parentNode.querySelector('input');
                // Limiter à 9999 articles pour éviter les problèmes d'affichage
                const currentValue = parseInt(input.value);
                if (currentValue < 9999) {
                    input.value = currentValue + 1;
                }
            };

            // Ajout des éléments au conteneur de quantité
            quantityContainer.appendChild(minusBtn);
            quantityContainer.appendChild(quantityInput);
            quantityContainer.appendChild(plusBtn);

            // Bouton Ajouter au panier
            const addBtn = document.createElement("button");
            addBtn.textContent = "Add to Cart";
            addBtn.className = "add-to-cart-btn";
            addBtn.onclick = function() {
                const quantity = parseInt(this.parentNode.querySelector('.quantity-input').value);
                if (quantity > 0) {
                    // Récupérer l'URL de l'image actuelle après toutes les tentatives de chargement
                    const actualImageUrl = this.closest('.product-item').querySelector('.product-img').src;
                    addToCart({...p, Nom: productName, prix: productPrice, categorie: productCategory}, quantity, actualImageUrl);
                    updateCartCount();
                    
                    // Mettre à jour le badge du panier dans le header
                    if (typeof updateCartUI === 'function') {
                        updateCartUI();
                    }
                }
            };

            // Ajout des éléments au conteneur d'actions
            actionContainer.appendChild(quantityContainer);
            actionContainer.appendChild(addBtn);

            // Ajout de tous les éléments à l'élément de liste
            li.appendChild(imgContainer);
            li.appendChild(infoContainer);
            li.appendChild(actionContainer);

            list.appendChild(li);
        });
}

// Fonction pour ajouter au panier
function addToCart(product, quantity, imageUrl) {
    console.log(`Ajout de ${quantity} ${product.Nom} au panier`);
    
    // Récupérer le panier actuel du localStorage ou créer un nouveau
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Vérifier si le produit est déjà dans le panier
    const existingProductIndex = cart.findIndex(item => 
        item.Nom === product.Nom && item.categorie === product.categorie
    );
    
    if (existingProductIndex !== -1) {
        // Mettre à jour la quantité si le produit existe déjà
        cart[existingProductIndex].quantity += quantity;
    } else {
        // Ajouter le nouveau produit au panier
        cart.push({
            ...product,
            quantity: quantity,
            imageUrl: imageUrl
        });
    }
    
    // Sauvegarder dans localStorage
    localStorage.setItem('cart', JSON.stringify(cart));
    
    // Afficher une notification au lieu d'une alerte
    showNotification(`${quantity} × ${product.Nom} added to cart !`, 'success');
}

// Fonction pour mettre à jour l'affichage du nombre d'articles dans le panier
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    const cartCountElement = document.querySelector('.cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = cartCount;
    }
    
    // Mettre à jour le compteur dans le header aussi
    if (typeof updateHeaderCartCount === 'function') {
        updateHeaderCartCount();
    }
}

// Fonction pour afficher le contenu du panier dans la modale
function displayCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    cartItemsContainer.innerHTML = '';
    
    let totalAmount = 0;
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Empty Cart</p>';
    } else {
        cart.forEach((item, index) => {
            const itemTotal = parseFloat(item.prix) * item.quantity;
            totalAmount += itemTotal;
            
            const cartItemElement = document.createElement('div');
            cartItemElement.className = 'cart-item';
            cartItemElement.innerHTML = `
                <div class="cart-item-img">
                    <img src="${item.imageUrl}" alt="${item.Nom}">
                </div>
                <div class="cart-item-details">
                    <h3>${item.Nom}</h3>
                    <p>Unit price: ${item.prix} CHF</p>
                    <p>Quantity: ${item.quantity}</p>
                </div>
                <div class="cart-item-total">
                    <p>${itemTotal.toFixed(2)} CHF</p>
                    <button class="remove-item-btn" data-index="${index}">Remove</button>
                </div>
            `;
            
            cartItemsContainer.appendChild(cartItemElement);
        });
        
        // Ajouter des écouteurs d'événements pour les boutons de suppression
        document.querySelectorAll('.remove-item-btn').forEach(button => {
            button.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                removeCartItem(index);
            });
        });
    }
    
    // Mettre à jour le montant total
    document.getElementById('cart-total-amount').textContent = totalAmount.toFixed(2);
}

// Fonction pour supprimer un article du panier
function removeCartItem(index) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    
    displayCart();
    updateCartCount();
    
    // Mettre à jour le badge du panier dans le header
    if (typeof updateCartUI === 'function') {
        updateCartUI();
    }
}

// Fonction de recherche de produits
function searchProducts(query, products) {
    if (!query || query.trim() === '') {
        return products; // Retourne tous les produits si la recherche est vide
    }
    
    query = query.toLowerCase().trim();
    
    return products.filter(product => {
        // Vérifier si le produit a un nom valide
        if (!product.Nom) return false;
        
        const productName = product.Nom.toLowerCase();
        const productCategory = (product.categorie || '').toLowerCase();
        
        // Recherche dans le nom du produit et la catégorie
        return productName.includes(query) || productCategory.includes(query);
    });
}

// Document ready
document.addEventListener('DOMContentLoaded', function() {
    // Variable pour stocker tous les produits
    let allProducts = [];
    
    // Fonction pour effectuer la recherche
    function performSearch() {
        const searchQuery = document.getElementById('searchInput').value;
    
        // Si la recherche est vide, ne rien faire
        if (!searchQuery || searchQuery.trim() === '') {
            return;
        }
    
        // Si nous n'avons pas encore chargé les produits, faisons-le maintenant
        if (allProducts.length === 0) {
            fetchProducts().then(products => {
                allProducts = products.filter(p => p.Nom && p.Nom.trim() !== "");
                // Rechercher à travers TOUTES les catégories
                const filteredProducts = searchProducts(searchQuery, allProducts);
                displayProducts(filteredProducts);
                
                // Mettre à jour la sélection de catégorie
                document.getElementById('categoryFilter').value = "all";
                
                // Mettre à jour les éléments de catégorie dans le menu
                const categoryItems = document.querySelectorAll('.category-item');
                categoryItems.forEach(item => {
                    item.classList.remove('active');
                    if (item.getAttribute('data-category') === 'all') {
                        item.classList.add('active');
                    }
                });
            });
        } else {
            // Rechercher à travers TOUTES les catégories
            const filteredProducts = searchProducts(searchQuery, allProducts);
            displayProducts(filteredProducts);
            
            // Mettre à jour la sélection de catégorie
            document.getElementById('categoryFilter').value = "all";
            
            // Mettre à jour les éléments de catégorie dans le menu
            const categoryItems = document.querySelectorAll('.category-item');
            categoryItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-category') === 'all') {
                    item.classList.add('active');
                }
            });
        }
    }
    
    // Écouteur d'événement pour la touche Entrée dans le champ de recherche
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    // Écouteur d'événement pour le bouton de recherche
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', performSearch);
    }
    
    // Filtre par catégorie (pour le select caché)
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', async function() {
            const selectedCategory = this.value;
            
            // Obtenir la valeur actuelle de la recherche
            const searchQuery = document.getElementById('searchInput')?.value || '';
            
            // Si une recherche est en cours, filtrer d'abord par la recherche
            if (searchQuery && searchQuery.trim() !== '') {
                // Si nous n'avons pas encore chargé les produits, faisons-le maintenant
                if (allProducts.length === 0) {
                    allProducts = await fetchProducts();
                    allProducts = allProducts.filter(p => p.Nom && p.Nom.trim() !== "");
                }
                
                const searchFilteredProducts = searchProducts(searchQuery, allProducts);
                
                // Puis appliquer le filtre de catégorie
                if (selectedCategory === "all") {
                    displayProducts(searchFilteredProducts);
                } else {
                    const finalFilteredProducts = searchFilteredProducts.filter(p => p.categorie === selectedCategory);
                    displayProducts(finalFilteredProducts);
                }
            } else {
                // Sinon, simplement filtrer par catégorie comme avant
                if (allProducts.length === 0) {
                    allProducts = await fetchProducts();
                    allProducts = allProducts.filter(p => p.Nom && p.Nom.trim() !== "");
                }
                displayProducts(allProducts, selectedCategory);
            }
        });
    }
    
    // Fermer la modale du panier
    const closeModal = document.querySelector('.close-modal');
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            const cartModal = document.getElementById('cart-modal');
            if (cartModal) {
                cartModal.style.display = 'none';
            }
        });
    }
    
    // Clic en dehors de la modale pour la fermer
    window.addEventListener('click', function(event) {
        const cartModal = document.getElementById('cart-modal');
        if (cartModal && event.target === cartModal) {
            cartModal.style.display = 'none';
        }
    });
    
    // Checkout button
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
            const cart = JSON.parse(localStorage.getItem('cart')) || [];
            
            if (cart.length === 0) {
                showNotification('Empty Cart', 'error');
                return;
            }
            
            // Envoyer la commande au serveur
            fetch('/api/save-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ items: cart })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification('Order placed successfully !', 'success');
                    // Vider le panier après la commande
                    localStorage.removeItem('cart');
                    updateCartCount();
                    // Mettre à jour le badge du panier dans le header
                    if (typeof updateCartUI === 'function') {
                        updateCartUI();
                    }
                    // Fermer la modale du panier
                    const cartModal = document.getElementById('cart-modal');
                    if (cartModal) {
                        cartModal.style.display = 'none';
                    }
                }
            })
            .catch(error => {
                console.error('Erreur:', error);
                showNotification('Erreur lors de la commande', 'error');
            });
        });
    }
    
    // Chargement initial des produits
    (async () => {
        allProducts = await fetchProducts();
        // Filtrer les produits sans nom valide pour éviter les "Produit sans nom"
        allProducts = allProducts.filter(p => p.Nom && p.Nom.trim() !== "");
        displayProducts(allProducts);
        updateCartCount();
    })();
});