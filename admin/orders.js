// Orders Management Script
let currentOrders = [];

// Load pending orders from the API
function loadPendingOrders() {
    const ordersContainer = document.getElementById('pending-orders-container');
    
    // Show loading state
    ordersContainer.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading orders...</p>
        </div>
    `;
    
    fetch('/api/admin/pending-orders')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(orders => {
            currentOrders = orders;
            
            if (orders.length === 0) {
                ordersContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-check-circle"></i>
                        <p>No pending orders to process!</p>
                    </div>
                `;
                return;
            }
            
            // Create the table to display orders
            let tableHTML = `
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>Shop</th>
                            <th>Items</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            orders.forEach(order => {
                const orderDate = new Date(order.date).toLocaleDateString('fr-CH');
                const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
                const customerName = order.userProfile ? order.userProfile.fullName : 'Unknown';
                const shopName = order.userProfile ? order.userProfile.shopName : 'Unknown';
                
                tableHTML += `
                    <tr>
                        <td>${order.orderId.substring(6)}</td>
                        <td>${orderDate}</td>
                        <td>${customerName}</td>
                        <td>${shopName}</td>
                        <td>${itemCount} items</td>
                        <td>
                            <button class="process-btn" data-order-id="${order.orderId}">
                                <i class="fas fa-shipping-fast"></i> Process
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            tableHTML += `
                    </tbody>
                </table>
            `;
            
            ordersContainer.innerHTML = tableHTML;
            
            // Add event listeners to process buttons
            document.querySelectorAll('.process-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const orderId = this.getAttribute('data-order-id');
                    openProcessOrderModal(orderId);
                });
            });
        })
        .catch(error => {
            console.error('Error fetching orders:', error);
            ordersContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading orders. Please try again.</p>
                </div>
            `;
        });
}

// Open the modal to process an order
function openProcessOrderModal(orderId) {
    const modal = document.getElementById('process-order-modal');
    const orderDetails = document.getElementById('order-details');
    const deliveryItemsContainer = document.getElementById('delivery-items-container');
    
    // Find the order in the currentOrders array
    const order = currentOrders.find(o => o.orderId === orderId);
    
    if (!order) {
        showNotification('Order not found', 'error');
        return;
    }
    
    // Display order details
    const orderDate = new Date(order.date).toLocaleDateString('fr-CH');
    const customerInfo = order.userProfile || {};
    
    orderDetails.innerHTML = `
        <div class="order-meta">
            <div class="order-id">
                <strong>Order ID:</strong> ${order.orderId}
            </div>
            <div class="order-date">
                <strong>Date:</strong> ${orderDate}
            </div>
        </div>
        
        <div class="customer-info">
            <h3>Customer Information</h3>
            <p><strong>Name:</strong> ${customerInfo.fullName || 'N/A'}</p>
            <p><strong>Shop:</strong> ${customerInfo.shopName || 'N/A'}</p>
            <p><strong>Email:</strong> ${customerInfo.email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${customerInfo.phone || 'N/A'}</p>
        </div>
        
        <div class="order-items">
            <h3>Ordered Items</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.items.map(item => `
                        <tr>
                            <td>${item.Nom}</td>
                            <td>${item.quantity}</td>
                            <td>${parseFloat(item.prix).toFixed(2)} CHF</td>
                            <td>${(parseFloat(item.prix) * item.quantity).toFixed(2)} CHF</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    // Create delivery form
    deliveryItemsContainer.innerHTML = `
        <p class="delivery-instructions">Specify the quantity of each item to ship:</p>
        <table class="delivery-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Ordered</th>
                    <th>To Ship</th>
                </tr>
            </thead>
            <tbody>
                ${order.items.map(item => `
                    <tr>
                        <td>${item.Nom}</td>
                        <td>${item.quantity}</td>
                        <td>
                            <input 
                                type="number" 
                                class="delivery-quantity" 
                                data-product="${item.Nom}"
                                data-category="${item.categorie}"
                                data-price="${item.prix}"
                                data-ordered="${item.quantity}"
                                min="0" 
                                max="${item.quantity}" 
                                value="${item.quantity}"
                            >
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // Setup the process button
    const processBtn = document.getElementById('process-order-btn');
    processBtn.onclick = function() {
        processOrder(order);
    };
    
    // Show the modal
    modal.style.display = 'block';
}

// Process an order based on the form data
function processOrder(order) {
    // Get all delivery quantity inputs
    const deliveryInputs = document.querySelectorAll('.delivery-quantity');
    const deliveredItems = [];
    
    // Create the list of delivered items
    deliveryInputs.forEach(input => {
        const quantity = parseInt(input.value);
        if (quantity > 0) {
            deliveredItems.push({
                Nom: input.getAttribute('data-product'),
                categorie: input.getAttribute('data-category'),
                prix: input.getAttribute('data-price'),
                quantity: quantity
            });
        }
    });
    
    if (deliveredItems.length === 0) {
        showNotification('Please specify at least one item to ship', 'error');
        return;
    }
    
    // Prepare data for API
    const processData = {
        userId: order.userId,
        orderId: order.orderId,
        deliveredItems: deliveredItems
    };
    
    // Send request to process the order
    fetch('/api/admin/process-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(processData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to process order');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Close the modal
            document.getElementById('process-order-modal').style.display = 'none';
            
            // Show success notification
            showNotification(`Order processed successfully! Status: ${data.status}`, 'success');
            
            // Reload orders
            loadPendingOrders();
        } else {
            showNotification('Error: ' + (data.error || 'Unknown error'), 'error');
        }
    })
    .catch(error => {
        console.error('Error processing order:', error);
        showNotification('Error processing order. Please try again.', 'error');
    });
}

// Add event listener to refresh button
document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refresh-orders');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadPendingOrders);
    }
});