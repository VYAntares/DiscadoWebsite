// Client Management Script
let clientsData = [];

// Load client data
function loadClientData() {
    const clientsContainer = document.getElementById('clients-container');
    
    // Show loading state
    clientsContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading client data...</p>
        </div>
    `;
    
    fetch('/api/admin/client-profiles')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(clients => {
            clientsData = clients;
            
            if (clients.length === 0) {
                clientsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users-slash"></i>
                        <p>No client data available.</p>
                    </div>
                `;
                return;
            }
            
            // Create the table to display clients
            let tableHTML = `
                <div class="search-container">
                    <input type="text" id="client-search" placeholder="Search clients...">
                    <button id="search-btn"><i class="fas fa-search"></i></button>
                </div>
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Client Name</th>
                            <th>Shop Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Location</th>
                            <th>Data Source</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            clients.forEach(client => {
                const lastUpdated = client.lastUpdated ? new Date(client.lastUpdated).toLocaleDateString('fr-CH') : 'N/A';
                const location = client.shopCity || client.city || 'N/A';
                
                // Add a data source indicator tag
                let sourceTag = '';
                if (client.source) {
                    let sourceColor = '';
                    let sourceLabel = '';
                    
                    switch(client.source) {
                        case 'data_client':
                            sourceColor = '#4CAF50'; // Green
                            sourceLabel = 'Complete Profile';
                            break;
                        case 'data_store_dir':
                        case 'data_store_json':
                            sourceColor = '#FF9800'; // Orange
                            sourceLabel = 'From Orders';
                            break;
                        case 'pending_order':
                            sourceColor = '#2196F3'; // Blue
                            sourceLabel = 'From Order';
                            break;
                        default:
                            sourceColor = '#9E9E9E'; // Gray
                            sourceLabel = 'Unknown';
                    }
                    
                    sourceTag = `<span class="source-tag" style="background-color: ${sourceColor}">${sourceLabel}</span>`;
                }
                
                tableHTML += `
                    <tr>
                        <td>${client.fullName || `${client.firstName || ''} ${client.lastName || ''}`}</td>
                        <td>${client.shopName || 'N/A'}</td>
                        <td>${client.email || 'N/A'}</td>
                        <td>${client.phone || 'N/A'}</td>
                        <td>${location}</td>
                        <td>${sourceTag}</td>
                        <td>
                            <button class="view-client-btn" data-client-id="${client.id}">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            tableHTML += `
                    </tbody>
                </table>
            `;
            
            clientsContainer.innerHTML = tableHTML;
            
            // Add event listeners to view buttons
            document.querySelectorAll('.view-client-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const clientId = this.getAttribute('data-client-id');
                    viewClientDetails(clientId);
                });
            });
            
            // Add search functionality
            const searchInput = document.getElementById('client-search');
            const searchBtn = document.getElementById('search-btn');
            
            if (searchInput && searchBtn) {
                const performSearch = () => {
                    const searchTerm = searchInput.value.toLowerCase().trim();
                    filterClients(searchTerm);
                };
                
                searchInput.addEventListener('keyup', function(e) {
                    if (e.key === 'Enter') {
                        performSearch();
                    }
                });
                
                searchBtn.addEventListener('click', performSearch);
            }
        })
        .catch(error => {
            console.error('Error fetching client data:', error);
            clientsContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading client data. Please try again.</p>
                    <p class="error-details">${error.message}</p>
                </div>
            `;
        });
}

// Filter clients based on search term
function filterClients(searchTerm) {
    if (!searchTerm) {
        // If search is empty, reload all clients
        displayFilteredClients(clientsData);
        return;
    }
    
    const filteredClients = clientsData.filter(client => {
        // Search across multiple fields
        return (
            (client.fullName && client.fullName.toLowerCase().includes(searchTerm)) || 
            (client.firstName && client.firstName.toLowerCase().includes(searchTerm)) ||
            (client.lastName && client.lastName.toLowerCase().includes(searchTerm)) ||
            (client.shopName && client.shopName.toLowerCase().includes(searchTerm)) ||
            (client.email && client.email.toLowerCase().includes(searchTerm)) ||
            (client.phone && client.phone.toLowerCase().includes(searchTerm)) ||
            (client.shopCity && client.shopCity.toLowerCase().includes(searchTerm)) ||
            (client.city && client.city.toLowerCase().includes(searchTerm)) ||
            (client.username && client.username.toLowerCase().includes(searchTerm))
        );
    });
    
    displayFilteredClients(filteredClients);
}

// Display filtered client list
function displayFilteredClients(clients) {
    const tbody = document.querySelector('.admin-table tbody');
    
    if (!tbody) return;
    
    if (clients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="no-results">No clients found matching your search.</td>
            </tr>
        `;
        return;
    }
    
    let rowsHTML = '';
    
    clients.forEach(client => {
        const lastUpdated = client.lastUpdated ? new Date(client.lastUpdated).toLocaleDateString('fr-CH') : 'N/A';
        const location = client.shopCity || client.city || 'N/A';
        
        // Add a data source indicator tag
        let sourceTag = '';
        if (client.source) {
            let sourceColor = '';
            let sourceLabel = '';
            
            switch(client.source) {
                case 'data_client':
                    sourceColor = '#4CAF50'; // Green
                    sourceLabel = 'Complete Profile';
                    break;
                case 'data_store_dir':
                case 'data_store_json':
                    sourceColor = '#FF9800'; // Orange
                    sourceLabel = 'From Orders';
                    break;
                case 'pending_order':
                    sourceColor = '#2196F3'; // Blue
                    sourceLabel = 'From Order';
                    break;
                default:
                    sourceColor = '#9E9E9E'; // Gray
                    sourceLabel = 'Unknown';
            }
            
            sourceTag = `<span class="source-tag" style="background-color: ${sourceColor}">${sourceLabel}</span>`;
        }
        
        rowsHTML += `
            <tr>
                <td>${client.fullName || `${client.firstName || ''} ${client.lastName || ''}`}</td>
                <td>${client.shopName || 'N/A'}</td>
                <td>${client.email || 'N/A'}</td>
                <td>${client.phone || 'N/A'}</td>
                <td>${location}</td>
                <td>${sourceTag}</td>
                <td>
                    <button class="view-client-btn" data-client-id="${client.id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = rowsHTML;
    
    // Re-add event listeners to view buttons
    document.querySelectorAll('.view-client-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const clientId = this.getAttribute('data-client-id');
            viewClientDetails(clientId);
        });
    });
}

// View client details in a modal
function viewClientDetails(clientId) {
    const modal = document.getElementById('client-details-modal');
    const clientDetailsContainer = document.getElementById('client-details');
    
    // Find the client in the clientsData array
    const client = clientsData.find(c => c.id === clientId);
    
    if (!client) {
        showNotification('Client not found', 'error');
        return;
    }
    
    // Format the last updated date
    const lastUpdated = client.lastUpdated 
        ? new Date(client.lastUpdated).toLocaleString('fr-CH') 
        : 'Not available';
    
    // Determine the data source label
    let sourceLabel = 'Unknown Source';
    let sourceClass = 'source-unknown';
    
    if (client.source) {
        switch(client.source) {
            case 'data_client':
                sourceLabel = 'Complete Profile (data_client)';
                sourceClass = 'source-complete';
                break;
            case 'data_store_dir':
                sourceLabel = 'From Order Directory (data_store)';
                sourceClass = 'source-orders';
                break;
            case 'data_store_json':
                sourceLabel = 'From Order JSON (data_store)';
                sourceClass = 'source-orders';
                break;
            case 'pending_order':
                sourceLabel = 'From Pending Order';
                sourceClass = 'source-pending';
                break;
        }
    }
    
    // Add source information
    const sourceInfo = `<div class="source-info ${sourceClass}">${sourceLabel}</div>`;
    
    // Display notes if available
    const notesSection = client.notes 
        ? `<div class="client-notes"><strong>Notes:</strong> ${client.notes}</div>` 
        : '';
    
    // Display client details
    clientDetailsContainer.innerHTML = `
        ${sourceInfo}
        ${notesSection}
        <div class="client-details-grid">
            <div class="client-personal-info">
                <h3>Personal Information</h3>
                <table class="details-table">
                    <tr>
                        <th>User ID:</th>
                        <td>${client.username || 'Not available'}</td>
                    </tr>
                    <tr>
                        <th>Full Name:</th>
                        <td>${client.fullName || `${client.firstName || ''} ${client.lastName || ''}`}</td>
                    </tr>
                    <tr>
                        <th>Email:</th>
                        <td>${client.email || 'Not provided'}</td>
                    </tr>
                    <tr>
                        <th>Phone:</th>
                        <td>${client.phone || 'Not provided'}</td>
                    </tr>
                    <tr>
                        <th>Last Updated:</th>
                        <td>${lastUpdated}</td>
                    </tr>
                </table>
            </div>
            
            <div class="client-shop-info">
                <h3>Shop Information</h3>
                <table class="details-table">
                    <tr>
                        <th>Shop Name:</th>
                        <td>${client.shopName || 'Not provided'}</td>
                    </tr>
                    <tr>
                        <th>Address:</th>
                        <td>${client.shopAddress || client.address || 'Not provided'}</td>
                    </tr>
                    <tr>
                        <th>City:</th>
                        <td>${client.shopCity || client.city || 'Not provided'}</td>
                    </tr>
                    <tr>
                        <th>ZIP Code:</th>
                        <td>${client.shopZipCode || client.postalCode || 'Not provided'}</td>
                    </tr>
                </table>
            </div>
        </div>
    `;
    
    // Show the modal
    modal.style.display = 'block';
}

// Add event listener to refresh button
document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refresh-clients');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadClientData);
    }
});