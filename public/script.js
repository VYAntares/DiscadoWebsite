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

// Fonction pour obtenir l'URL de l'image en fonction de la catégorie
function getImageUrl(category) {
    // Ici, vous pourriez remplacer par de vraies images spécifiques à chaque produit
    const categoryImages = {
        'magnet': '/images/magnet-default.jpg',
        'keyring': '/images/keyring-default.jpg',
        'pens': '/images/pen-default.jpg',
        'bags': '/images/bag-default.jpg',
        'hats': '/images/hat-default.jpg',
        'caps': '/images/cap-default.jpg',
        'bells': '/images/bell-default.jpg',
        'softtoy': '/images/softtoy-default.jpg',
        'tshirt': '/images/tshirt-default.jpg',
        'lighter': '/images/lighter-default.jpg',
        // Ajouter d'autres catégories au besoin
    };
    
    // Si pas d'image spécifique, utiliser une image par défaut
    return categoryImages[category] || '/images/product-default.jpg';
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

            // Compteur de quantité
            const quantityContainer = document.createElement("div");
            quantityContainer.className = "quantity-container";

            // Bouton moins
            const minusBtn = document.createElement("button");
            minusBtn.textContent = "-";
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

            // Bouton plus
            const plusBtn = document.createElement("button");
            plusBtn.textContent = "+";
            plusBtn.className = "quantity-btn plus-btn";
            plusBtn.onclick = function() {
                const input = this.parentNode.querySelector('input');
                input.value = parseInt(input.value) + 1;
            };

            // Ajout des éléments au conteneur de quantité
            quantityContainer.appendChild(minusBtn);
            quantityContainer.appendChild(quantityInput);
            quantityContainer.appendChild(plusBtn);

            // Bouton Ajouter au panier
            const addBtn = document.createElement("button");
            addBtn.textContent = "Ajouter au panier";
            addBtn.className = "add-to-cart-btn";
            addBtn.onclick = function() {
                const quantity = parseInt(this.parentNode.querySelector('.quantity-input').value);
                if (quantity > 0) {
                    // Récupérer l'URL de l'image actuelle après toutes les tentatives de chargement
                    const actualImageUrl = this.closest('.product-item').querySelector('.product-img').src;
                    addToCart({...p, Nom: productName, prix: productPrice, categorie: productCategory}, quantity, actualImageUrl);
                    updateCartCount();
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
    
    // Afficher un message de confirmation
    alert(`${quantity} ${product.Nom} ajouté(s) au panier`);
}

// Fonction pour mettre à jour l'affichage du nombre d'articles dans le panier
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelector('.cart-count').textContent = cartCount;
}

// Fonction pour afficher le contenu du panier dans la modale
function displayCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    cartItemsContainer.innerHTML = '';
    
    let totalAmount = 0;
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Votre panier est vide</p>';
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
                    <p>Prix unitaire: ${item.prix} CHF</p>
                    <p>Quantité: ${item.quantity}</p>
                </div>
                <div class="cart-item-total">
                    <p>${itemTotal.toFixed(2)} CHF</p>
                    <button class="remove-item-btn" data-index="${index}">Supprimer</button>
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
}

// Attacher les écouteurs d'événements
document.addEventListener('DOMContentLoaded', function() {
    // Variable pour stocker tous les produits
    let allProducts = [];
    
    // Fonction pour ajuster la marge supérieure du main en fonction de la hauteur réelle du header
    function adjustMainMargin() {
        const header = document.querySelector('header');
        const main = document.querySelector('main');
        if (header && main) {
            const headerHeight = header.offsetHeight;
            main.style.marginTop = (headerHeight - 140) + 'px'; // Utilisation de votre valeur d'offset
        }
    }
    
    // Appel initial pour régler la marge
    adjustMainMargin();
    
    // Réajuster en cas de redimensionnement
    window.addEventListener('resize', adjustMainMargin);
    
    // Gestion du scroll pour l'en-tête sur mobile
    let lastScrollTop = 0;
    window.addEventListener('scroll', function() {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const header = document.querySelector('header');
        
        // Si on est tout en haut de la page OU si on remonte
        if (currentScrollTop <= 10 || currentScrollTop < lastScrollTop) {
            header.style.transform = 'translateY(0)';
            setTimeout(adjustMainMargin, 200); // Réajuster après l'animation
        } 
        // Si on descend la page (scroll vers le bas)
        else if (currentScrollTop > lastScrollTop) {
            header.style.transform = 'translateY(-100%)';
        }
        
        lastScrollTop = currentScrollTop;
    });
    
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
    
    // Fonction pour effectuer la recherche
    async function performSearch() {
        const searchQuery = document.getElementById('searchInput').value;
        
        // Si nous n'avons pas encore chargé les produits, faisons-le maintenant
        if (allProducts.length === 0) {
            allProducts = await fetchProducts();
        }
        
        // Filtrer les produits selon la requête de recherche
        const filteredProducts = searchProducts(searchQuery, allProducts);
        
        // Obtenir la catégorie actuellement sélectionnée
        const categorySelect = document.getElementById('categoryFilter');
        const selectedCategory = categorySelect.value;
        
        // Afficher les produits filtrés, en respectant également le filtre de catégorie si ce n'est pas "all"
        if (selectedCategory === "all") {
            displayProducts(filteredProducts);
        } else {
            const categoryFilteredProducts = filteredProducts.filter(p => p.categorie === selectedCategory);
            displayProducts(categoryFilteredProducts);
        }
    }
    
    // Écouteur d'événement pour la touche Entrée dans le champ de recherche
    document.getElementById('searchInput').addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            performSearch();
        }
    });
    
    // Écouteur d'événement pour le bouton de recherche
    document.getElementById('searchButton').addEventListener('click', performSearch);
    
    // Filtre par catégorie
    document.getElementById('categoryFilter').addEventListener('change', async function() {
        const selectedCategory = this.value;
        
        // Obtenir la valeur actuelle de la recherche
        const searchQuery = document.getElementById('searchInput').value;
        
        // Si une recherche est en cours, filtrer d'abord par la recherche
        if (searchQuery && searchQuery.trim() !== '') {
            // Si nous n'avons pas encore chargé les produits, faisons-le maintenant
            if (allProducts.length === 0) {
                allProducts = await fetchProducts();
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
            }
            displayProducts(allProducts, selectedCategory);
        }
    });
    
    // Ouvrir la modale du panier
    document.getElementById('view-cart').addEventListener('click', function(e) {
        e.preventDefault();
        displayCart();
        document.getElementById('cart-modal').style.display = 'block';
    });
    
    // Fermer la modale du panier
    document.querySelector('.close-modal').addEventListener('click', function() {
        document.getElementById('cart-modal').style.display = 'none';
    });
    
    // Clic en dehors de la modale pour la fermer
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('cart-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Bouton passer la commande
    document.getElementById('checkout-btn').addEventListener('click', function() {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        
        if (cart.length === 0) {
            alert('Votre panier est vide');
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
                alert('Commande passée avec succès!');
                // Vider le panier après la commande
                localStorage.removeItem('cart');
                updateCartCount();
                // Fermer la modale du panier
                document.getElementById('cart-modal').style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            alert('Erreur lors de la commande');
        });
    });
    
    // Chargement initial des produits
    (async () => {
        allProducts = await fetchProducts();
        // Filtrer les produits sans nom valide pour éviter les "Produit sans nom"
        allProducts = allProducts.filter(p => p.Nom && p.Nom.trim() !== "");
        displayProducts(allProducts);
        updateCartCount();
    })();
});