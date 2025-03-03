document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    const clientTableBody = document.getElementById('clientTableBody');
    const clientModal = document.getElementById('clientModal');
    const clientDetailsContent = document.getElementById('clientDetailsContent');
    const clientDetailsTitle = document.getElementById('clientDetailsTitle');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const closeModal = document.querySelector('.close-modal');
    
    // Charger la liste des clients
    loadClients();
    
    // Fonction pour charger la liste des clients
    function loadClients() {
        fetch('/api/admin/client-profiles')
            .then(response => response.json())
            .then(clients => {
                displayClients(clients);
            })
            .catch(error => {
                console.error('Erreur lors du chargement des clients:', error);
                clientTableBody.innerHTML = '<tr><td colspan="4" class="loading">Erreur lors du chargement des clients. Veuillez réessayer.</td></tr>';
            });
    }
    
    // Fonction pour afficher les clients dans le tableau
    function displayClients(clients) {
        if (clients.length === 0) {
            clientTableBody.innerHTML = '<tr><td colspan="4" class="loading">Aucun client trouvé.</td></tr>';
            return;
        }
        
        clientTableBody.innerHTML = '';
        
        clients.forEach(client => {
            const fullName = client.fullName || `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.username || 'N/A';
            const shopName = client.shopName || 'N/A';
            const email = client.email || 'N/A';
            const phone = client.phone || 'N/A';
            const clientId = client.username || client.id || 'N/A';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${clientId}</td>
                <td>
                    <span class="client-name">${fullName}</span>
                    <span class="client-shop">${shopName}</span>
                </td>
                <td>
                    <div>${email}</div>
                    <div>${phone}</div>
                </td>
                <td>
                    <button class="action-btn view-client-btn" data-client-id="${clientId}">Voir détails</button>
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
    
    // Fonction pour afficher les détails d'un client
    function viewClientDetails(clientId) {
        // Charger les détails du client
        fetch('/api/admin/client-profiles')
            .then(response => response.json())
            .then(clients => {
                const client = clients.find(c => c.username === clientId || c.id === clientId);
                if (client) {
                    displayClientDetails(client);
                    clientModal.style.display = 'block';
                } else {
                    alert('Client non trouvé');
                }
            })
            .catch(error => {
                console.error('Erreur lors du chargement des détails du client:', error);
                alert('Erreur lors du chargement des détails du client');
            });
    }
    
    // Fonction pour afficher les détails du client dans la modal
    function displayClientDetails(client) {
        clientDetailsTitle.textContent = `Détails du client: ${client.fullName || client.username || 'N/A'}`;
        
        // Construire le contenu HTML pour les détails du client
        let html = `
            <div class="client-details-section">
                <h3>Informations personnelles</h3>
                <div class="client-details-grid">
                    <div class="detail-item">
                        <span class="detail-label">ID Client:</span>
                        <span class="detail-value">${client.username || client.id || 'N/A'}</span>
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
                        <span class="detail-label">Nom complet:</span>
                        <span class="detail-value">${client.fullName || `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'N/A'}</span>
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
        `;
        
        // Ajouter toutes les autres informations disponibles dans une section "Métadonnées"
        html += `
            <div class="client-details-section">
                <h3>Métadonnées</h3>
                <div class="metadata">
        `;
        
        // Parcourir toutes les propriétés et les afficher
        for (const [key, value] of Object.entries(client)) {
            // Ignorer les propriétés déjà affichées
            const ignoredProps = ['firstName', 'lastName', 'fullName', 'email', 'phone', 
                                 'shopName', 'shopAddress', 'shopCity', 'shopZipCode',
                                 'address', 'city', 'postalCode', 'username', 'id'];
            
            if (!ignoredProps.includes(key)) {
                html += `<p><strong>${key}:</strong> ${value}</p>`;
            }
        }
        
        html += `
                </div>
            </div>
        `;
        
        // Mettre à jour le contenu de la modal
        clientDetailsContent.innerHTML = html;
    }
    
    // Fermer la modal quand on clique sur la croix
    closeModal.addEventListener('click', function() {
        clientModal.style.display = 'none';
    });
    
    // Fermer la modal quand on clique en dehors du contenu
    window.addEventListener('click', function(event) {
        if (event.target === clientModal) {
            clientModal.style.display = 'none';
        }
    });
    
    // Fonction de recherche
    function searchClients() {
        const searchValue = searchInput.value.toLowerCase().trim();
        
        if (!searchValue) {
            loadClients();
            return;
        }
        
        // Récupérer tous les clients puis filtrer
        fetch('/api/admin/client-profiles')
            .then(response => response.json())
            .then(clients => {
                const filteredClients = clients.filter(client => {
                    const fullName = (client.fullName || `${client.firstName || ''} ${client.lastName || ''}`.trim() || '').toLowerCase();
                    const shopName = (client.shopName || '').toLowerCase();
                    const email = (client.email || '').toLowerCase();
                    const phone = (client.phone || '').toLowerCase();
                    const username = (client.username || client.id || '').toLowerCase();
                    
                    return fullName.includes(searchValue) ||
                           shopName.includes(searchValue) ||
                           email.includes(searchValue) ||
                           phone.includes(searchValue) ||
                           username.includes(searchValue);
                });
                
                displayClients(filteredClients);
            })
            .catch(error => {
                console.error('Erreur lors de la recherche:', error);
            });
    }
    
    // Écouteur d'événement pour le bouton de recherche
    searchBtn.addEventListener('click', searchClients);
    
    // Recherche en appuyant sur Entrée
    searchInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            searchClients();
        }
    });
});