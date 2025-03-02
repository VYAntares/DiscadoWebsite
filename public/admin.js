document.addEventListener('DOMContentLoaded', function() {
    // Main tab switching functionality
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Existing tab switching code
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
        const tabId = this.getAttribute('data-tab');
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Update active content
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabId}-tab`).classList.add('active');
        
        // Load content based on tab
        if (tabId === 'orders') {
            loadOrders();
        } else if (tabId === 'customers') {
            loadCustomers();
        } else if (tabId === 'consolidated') {
            loadConsolidatedOrders(); // Add this line
        }
        });
    });
    
    // Order category tab switching functionality
    const orderTabs = document.querySelectorAll('.order-tab');
    const orderContents = document.querySelectorAll('.order-content');
    
    orderTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        const category = this.getAttribute('data-order-category');
        
        // Update active tab
        orderTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Update active content
        orderContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${category}-orders-content`).classList.add('active');
      });
    });
    
    // Load orders initially
    loadOrders();
    
    // Function to load orders
    function loadOrders() {
        const pendingContainer = document.getElementById('pending-orders-container');
        const partialContainer = document.getElementById('partial-orders-container');
        const completedContainer = document.getElementById('completed-orders-container');
        
        // Show loading state
        pendingContainer.className = 'loading';
        partialContainer.className = 'loading';
        completedContainer.className = 'loading';
        
        // Fetch orders from server
        fetch('/api/admin/orders')
          .then(response => {
            if (!response.ok) {
              throw new Error('Network response was not ok');
            }
            return response.json();
          })
          .then(data => {
            // Process the data
            const pendingOrders = [];
            const partialOrders = [];
            const completedOrders = [];
            
            // Process each user's orders
            Object.entries(data).forEach(([userId, userOrders]) => {
              userOrders.forEach(order => {
                order.userId = userId;
                
                // For partially shipped orders, create a "completion" version for the completed section
                if (order.status === 'partially_shipped') {
                  // Add the original order to partial orders with remaining items
                  partialOrders.push({
                    ...order,
                    isPartial: true
                  });
                  
                  // Only add to completed if there are shipped items
                  if (order.shippedItems && order.shippedItems.length > 0) {
                    // Create a virtual "completed" part of the order
                    completedOrders.push({
                      ...order,
                      items: order.shippedItems, // Only show shipped items
                      isVirtualCompletion: true,
                      status: 'shipped_portion'
                    });
                  }
                } else if (order.status === 'completed') {
                  completedOrders.push(order);
                } else {
                  pendingOrders.push(order);
                }
              });
            });
            
            // Sort orders by date, newest first
            pendingOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
            partialOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
            completedOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Render pending orders
            pendingContainer.className = '';
            if (pendingOrders.length === 0) {
              pendingContainer.innerHTML = '<div class="no-orders">No pending orders</div>';
            } else {
              pendingContainer.innerHTML = pendingOrders.map(order => createOrderCard(order, 'pending')).join('');
            }
            
            // Render partial orders
            partialContainer.className = '';
            if (partialOrders.length === 0) {
              partialContainer.innerHTML = '<div class="no-orders">No partial orders</div>';
            } else {
              partialContainer.innerHTML = partialOrders.map(order => createOrderCard(order, 'partial')).join('');
            }
            
            // Render completed orders
            completedContainer.className = '';
            if (completedOrders.length === 0) {
              completedContainer.innerHTML = '<div class="no-orders">No completed orders</div>';
            } else {
              completedContainer.innerHTML = completedOrders.map(order => createOrderCard(order, 'completed')).join('');
            }
            
            // Update orders count in the tabs
            document.querySelectorAll('.order-tab').forEach(tab => {
              const category = tab.getAttribute('data-order-category');
              let count = 0;
              
              if (category === 'pending') count = pendingOrders.length;
              else if (category === 'partial') count = partialOrders.length;
              else if (category === 'completed') count = completedOrders.length;
              
              // Add count badge
              const existingBadge = tab.querySelector('.count-badge');
              if (existingBadge) {
                existingBadge.textContent = count;
              } else {
                const badge = document.createElement('span');
                badge.className = 'count-badge';
                badge.textContent = count;
                tab.appendChild(badge);
              }
            });
          })
          .catch(error => {
            console.error('Error:', error);
            pendingContainer.className = '';
            partialContainer.className = '';
            completedContainer.className = '';
            pendingContainer.innerHTML = `<div class="no-orders">Error loading orders: ${error.message}</div>`;
            partialContainer.innerHTML = '';
            completedContainer.innerHTML = '';
            showNotification('Error loading orders: ' + error.message, 'error');
          });
      }
    
// This code will replace the existing loadCustomers function and add search functionality

// Store all customers data for filtering
let allCustomersData = {};

// Function to load customers with enhanced display and search capability
function loadCustomers() {
  const customersContainer = document.getElementById('customers-container');
  
  // Show loading state
  customersContainer.className = 'loading';
  
  // Fetch customers from server
  fetch('/api/admin/customers')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      // Store full customer data for filtering
      allCustomersData = data;
      
      // Render customers
      renderCustomers(data);
      
      // Initialize search if not already done
      initCustomerSearch();
    })
    .catch(error => {
      console.error('Error:', error);
      customersContainer.className = '';
      customersContainer.innerHTML = `<div class="no-orders">Error loading customers: ${error.message}</div>`;
      showNotification('Error loading customers: ' + error.message, 'error');
    });
}

// Function to render customers based on filtered data
function renderCustomers(customersData) {
  const customersContainer = document.getElementById('customers-container');
  customersContainer.className = '';
  
  if (Object.keys(customersData).length === 0) {
    customersContainer.innerHTML = '<div class="no-orders">No customers found</div>';
  } else {
    const customersHtml = Object.entries(customersData).map(([userId, customerInfo]) => `
      <div class="customer-item">
        <div class="customer-header">
          <div class="customer-name">${customerInfo.fullName || userId}</div>
          <div class="customer-id">ID: ${userId}</div>
        </div>
        
        <!-- Personal Information Section -->
        <div class="customer-section">
          <h4><i class="fas fa-user"></i> Personal Information</h4>
          <div class="customer-details">
            <div class="customer-detail">
              <span class="detail-label">First Name</span>
              <span class="detail-value">${customerInfo.firstName || 'N/A'}</span>
            </div>
            <div class="customer-detail">
              <span class="detail-label">Last Name</span>
              <span class="detail-value">${customerInfo.lastName || 'N/A'}</span>
            </div>
            <div class="customer-detail">
              <span class="detail-label">Email</span>
              <span class="detail-value">${customerInfo.email || 'N/A'}</span>
            </div>
            <div class="customer-detail">
              <span class="detail-label">Phone</span>
              <span class="detail-value">${customerInfo.phone || 'N/A'}</span>
            </div>
          </div>
        </div>
        
        <!-- Shop Information Section -->
        <div class="customer-section">
          <h4><i class="fas fa-store"></i> Shop Information</h4>
          <div class="customer-details">
            <div class="customer-detail">
              <span class="detail-label">Shop Name</span>
              <span class="detail-value">${customerInfo.shopName || 'N/A'}</span>
            </div>
            <div class="customer-detail">
              <span class="detail-label">Shop Address</span>
              <span class="detail-value">${customerInfo.shopAddress || customerInfo.address || 'N/A'}</span>
            </div>
            <div class="customer-detail">
              <span class="detail-label">Shop City</span>
              <span class="detail-value">${customerInfo.shopCity || customerInfo.city || 'N/A'}</span>
            </div>
            <div class="customer-detail">
              <span class="detail-label">Shop Zip Code</span>
              <span class="detail-value">${customerInfo.shopZipCode || customerInfo.postalCode || 'N/A'}</span>
            </div>
          </div>
        </div>
        
        <div class="customer-actions">
          <button class="btn btn-secondary customer-orders-btn" data-user-id="${userId}">
            <i class="fas fa-shopping-bag"></i> View Orders
          </button>
          <button class="btn btn-primary send-email-btn" data-email="${customerInfo.email || ''}">
            <i class="fas fa-envelope"></i> Send Email
          </button>
        </div>
      </div>
    `).join('');
    
    customersContainer.innerHTML = customersHtml;
    
    // Add event listeners to buttons
    document.querySelectorAll('.customer-orders-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const userId = this.getAttribute('data-user-id');
        // Implementation for viewing customer orders
        showNotification(`Viewing orders for ${userId} - Feature coming soon`, 'info');
      });
    });
    
    document.querySelectorAll('.send-email-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const email = this.getAttribute('data-email');
        if (email && email !== 'N/A') {
          window.open(`mailto:${email}`);
        } else {
          showNotification('No email address available', 'error');
        }
      });
    });
  }
}

// Function to initialize customer search
function initCustomerSearch() {
  // Check if search is already initialized
  if (document.getElementById('customer-search-input')) return;
  
  // Create search container if it doesn't exist
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container';
  searchContainer.innerHTML = `
    <div class="search-box">
      <input type="text" id="customer-search-input" placeholder="Search customers by name, shop, email..." />
      <button id="customer-search-btn">
        <i class="fas fa-search"></i>
      </button>
    </div>
    <div class="search-stats">
      <span id="search-results-count">${Object.keys(allCustomersData).length} customers found</span>
    </div>
  `;
  
  // Insert before the customers container
  const customersContainer = document.getElementById('customers-container');
  customersContainer.parentNode.insertBefore(searchContainer, customersContainer);
  
  // Add event listener for search
  const searchInput = document.getElementById('customer-search-input');
  const searchBtn = document.getElementById('customer-search-btn');
  
  const performSearch = () => {
    const searchTerm = searchInput.value.toLowerCase().trim();
    let filteredCustomers = {};
    
    if (searchTerm === '') {
      // If search is empty, show all customers
      filteredCustomers = allCustomersData;
    } else {
      // Filter customers based on search term
      Object.entries(allCustomersData).forEach(([userId, customerInfo]) => {
        // Check all relevant fields
        const searchFields = [
          customerInfo.firstName,
          customerInfo.lastName,
          customerInfo.fullName,
          customerInfo.email,
          customerInfo.phone,
          customerInfo.shopName,
          customerInfo.shopAddress,
          customerInfo.shopCity,
          customerInfo.shopZipCode,
          customerInfo.address,
          customerInfo.city,
          customerInfo.postalCode,
          userId
        ];
        
        // Check if any field contains the search term
        if (searchFields.some(field => 
          field && field.toString().toLowerCase().includes(searchTerm)
        )) {
          filteredCustomers[userId] = customerInfo;
        }
      });
    }
    
    // Update search stats
    const resultsCount = Object.keys(filteredCustomers).length;
    document.getElementById('search-results-count').textContent = 
      `${resultsCount} customer${resultsCount !== 1 ? 's' : ''} found`;
    
    // Render the filtered customers
    renderCustomers(filteredCustomers);
  };
  
  searchInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
      performSearch();
    }
  });
  
  searchBtn.addEventListener('click', performSearch);
}
    
    // Make loadOrders available globally
    window.loadOrders = loadOrders;
  });
  
  // Function to create an order card
  function createOrderCard(order, orderType) {
    // Calculate total
    let items = order.items;
    
    // Format invoice number in MM/JJ/HH/MM format
    const orderDate = new Date(order.date);
    
    // Format with padding for single digits
    const month = String(orderDate.getMonth() + 1).padStart(2, '0'); // +1 because months are 0-indexed
    const day = String(orderDate.getDate()).padStart(2, '0');
    const hours = String(orderDate.getHours()).padStart(2, '0');
    const minutes = String(orderDate.getMinutes()).padStart(2, '0');
    const year = String(orderDate.getFullYear()).padStart(2, '0');
    
    const invoiceNumber = `${year}${month}${day}${hours}${minutes}`;
    
    // Format date for display
    const displayDate = orderDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Create HTML for order items based on order type
    let itemsHtml = '';
    let total = 0;
    
    if (orderType === 'completed') {
      // For completed or shipped portions, show only shipped items
      const itemsToShow = order.isVirtualCompletion ? order.items : 
                          order.items.filter(item => item.shipped && item.shipped > 0);
      
      itemsHtml = itemsToShow.map(item => {
        const quantity = order.isVirtualCompletion ? item.quantity : item.shipped;
        const itemTotal = quantity * parseFloat(item.prix);
        total += itemTotal;
        
        return `
          <tr>
            <td>${item.Nom}</td>
            <td>${item.categorie}</td>
            <td class="text-center">${quantity}</td>
            <td>${item.prix} CHF</td>
            <td>${itemTotal.toFixed(2)} CHF</td>
          </tr>
        `;
      }).join('');
    } else if (orderType === 'partial') {
      // For partial orders, show remaining items to be shipped
      itemsHtml = order.items
        .filter(item => (!item.shipped && item.quantity > 0) || (item.shipped < item.quantity))
        .map(item => {
          const remaining = item.shipped ? item.quantity - item.shipped : item.quantity;
          const itemTotal = remaining * parseFloat(item.prix);
          total += itemTotal;
          
          return `
            <tr>
              <td>${item.Nom}</td>
              <td>${item.categorie}</td>
              <td class="text-center">${remaining}</td>
              <td>${item.prix} CHF</td>
              <td>${itemTotal.toFixed(2)} CHF</td>
            </tr>
          `;
        }).join('');
    } else {
      // For pending orders, show all items
      itemsHtml = order.items.map(item => {
        const itemTotal = item.quantity * parseFloat(item.prix);
        total += itemTotal;
        
        return `
          <tr>
            <td>${item.Nom}</td>
            <td>${item.categorie}</td>
            <td class="text-center">${item.quantity}</td>
            <td>${item.prix} CHF</td>
            <td>${itemTotal.toFixed(2)} CHF</td>
          </tr>
        `;
      }).join('');
    }
    
    // Create HTML for processing form items
    let formItemsHtml = '';
    
    if (orderType === 'partial') {
      // For partial orders, only show items that still need shipping
      formItemsHtml = order.items
        .filter(item => (!item.shipped && item.quantity > 0) || (item.shipped < item.quantity))
        .map(item => {
          const remaining = item.shipped ? item.quantity - item.shipped : item.quantity;
          return `
            <div class="form-row">
              <div class="item-name">${item.Nom}</div>
              <div class="ordered-qty">${remaining}</div>
              <div class="shipped-qty">
                <input type="number" min="0" max="${remaining}" value="0" />
              </div>
            </div>
          `;
        }).join('');
    } else {
      // For pending orders, show all items
      formItemsHtml = order.items.map(item => `
        <div class="form-row">
          <div class="item-name">${item.Nom}</div>
          <div class="ordered-qty">${item.quantity}</div>
          <div class="shipped-qty">
            <input type="number" min="0" max="${item.quantity}" value="0" />
          </div>
        </div>
      `).join('');
    }
    
    // Status badge and text
    let statusClass, statusText;
    
    if (orderType === 'completed') {
      if (order.isVirtualCompletion) {
        statusClass = 'status-partial';
        statusText = 'Shipped Portion';
      } else {
        statusClass = 'status-completed';
        statusText = 'Completed';
      }
    } else if (orderType === 'partial') {
      statusClass = 'status-partial';
      statusText = 'Partially Shipped';
    } else {
      statusClass = 'status-pending';
      statusText = 'In Progress';
    }
    
    // Additional information for split orders
    let additionalInfo = '';
    if (order.isVirtualCompletion) {
      additionalInfo = `
        <div class="order-info">
          <div class="alert alert-info">
            <i class="fas fa-info-circle"></i> This shows the shipped portion of a partially completed order.
          </div>
        </div>
      `;
    } else if (order.isPartial) {
      additionalInfo = `
        <div class="order-info">
          <div class="alert alert-info">
            <i class="fas fa-info-circle"></i> This shows the remaining items to be shipped.
          </div>
        </div>
      `;
    }
    
    // Create the card HTML
    return `
      <div class="order-card ${order.isVirtualCompletion ? 'virtual-completion' : ''}" data-order-id="${order.id || order.date}" data-user-id="${order.userId}">
        <div class="order-header">
          <div class="order-id">Invoice #${invoiceNumber}</div>
          <div class="order-date">${displayDate}</div>
          <div class="order-status ${statusClass}">${statusText}</div>
        </div>
        
        ${additionalInfo}
        
        <div class="customer-info">
          <div><strong>Customer:</strong> ${order.userId}</div>
          <!-- Additional customer info could be added here -->
        </div>
        
        <table class="order-items">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="order-total">
          Total: ${total.toFixed(2)} CHF
        </div>
        
        ${(orderType !== 'completed' && !order.isVirtualCompletion) ? `
          <div class="order-actions">
            <button class="btn btn-primary" onclick="processOrder('${order.id || order.date}', '${order.userId}', '${orderType}')">
              ${orderType === 'partial' ? 'Complete Shipping' : 'Process Order'}
            </button>
          </div>
          
          <div class="processing-form">
            <h4>${orderType === 'partial' ? 'Complete Shipping' : 'Process Order'}</h4>
            <div class="form-header form-row">
              <div class="item-name"><strong>Product</strong></div>
              <div class="ordered-qty"><strong>Ordered</strong></div>
              <div class="shipped-qty"><strong>Ship Now</strong></div>
            </div>
            ${formItemsHtml}
            <div class="form-actions">
              <button class="btn btn-secondary" onclick="processOrder('${order.id || order.date}', '${order.userId}', '${orderType}')">
                Cancel
              </button>
              <button class="btn btn-success" onclick="saveProcessedOrder('${order.id || order.date}', '${order.userId}', '${orderType}')">
                Save & Complete
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Process order function
  function processOrder(orderId, userId, orderType) {
    // Find the order card and processing form
    const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
    const processingForm = orderCard.querySelector('.processing-form');
    
    // Toggle form visibility
    const isVisible = processingForm.classList.contains('active');
    if (isVisible) {
      processingForm.classList.remove('active');
    } else {
      // Hide all other forms
      document.querySelectorAll('.processing-form.active').forEach(form => {
        form.classList.remove('active');
      });
      
      // Show this form
      processingForm.classList.add('active');
    }
  }
  
  // Save processed order function
  function saveProcessedOrder(orderId, userId, orderType) {
    const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
    const processingForm = orderCard.querySelector('.processing-form');
    
    // Collect the shipped quantities
    const items = [];
    processingForm.querySelectorAll('.form-row').forEach(row => {
      // Skip header row
      if (row.classList.contains('form-header')) return;
      
      const itemName = row.querySelector('.item-name').textContent;
      const orderedQty = parseInt(row.querySelector('.ordered-qty').textContent);
      const shippedQty = parseInt(row.querySelector('.shipped-qty input').value);
      
      items.push({
        name: itemName,
        orderedQty: orderedQty,
        shippedQty: shippedQty
      });
    });
    
    // Validate that shipped quantities are not greater than ordered quantities
    const invalidItems = items.filter(item => item.shippedQty > item.orderedQty);
    if (invalidItems.length > 0) {
      showNotification(`Shipped quantities cannot exceed ordered quantities for "${invalidItems[0].name}"`, 'error');
      return;
    }
    
    // Check if all quantities are shipped
    const allShipped = items.every(item => item.shippedQty === item.orderedQty);
    const status = allShipped ? 'completed' : 'partially_shipped';
    
    // Prepare data to send to server
    const updateData = {
      orderId: orderId,
      userId: userId,
      items: items,
      status: status
    };
    
    // Send to server
    fetch('/api/update-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        showNotification('Order updated successfully', 'success');
        // Reload orders to see the updated status
        setTimeout(() => {
          window.loadOrders();
        }, 1000);
      } else {
        showNotification(data.message || 'Error updating order', 'error');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showNotification('Error updating order: ' + error.message, 'error');
    });
  }
  
  // Show notification function
  function showNotification(message, type = 'success') {
    const notificationContainer = document.getElementById('notification-container');
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    let icon = '';
    switch(type) {
      case 'success':
        icon = '<i class="fas fa-check-circle"></i>';
        break;
      case 'error':
        icon = '<i class="fas fa-times-circle"></i>';
        break;
      case 'warning':
        icon = '<i class="fas fa-exclamation-triangle"></i>';
        break;
    }
    
    notification.innerHTML = `${icon} ${message}`;
    notificationContainer.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  function generateConsolidatedOrders(orderData) {
    const clientOrders = {};
    
    // Group orders by client
    Object.entries(orderData).forEach(([userId, orders]) => {
      // Filter out orders that have items that need to be shipped
      const ordersToProcess = orders.filter(order => {
        return order.status === 'partially_shipped' || order.status === 'in progress';
      });
      
      if (ordersToProcess.length > 0) {
        // Initialize consolidated items map to track highest quantities
        const consolidatedItems = new Map();
        
        // Process each order
        ordersToProcess.forEach(order => {
          order.items.forEach(item => {
            // Calculate remaining quantity to ship
            const shippedQuantity = item.shipped || 0;
            const remainingQuantity = item.quantity - shippedQuantity;
            
            if (remainingQuantity > 0) {
              const itemKey = `${item.Nom}-${item.categorie}`;
              
              // If item already exists in consolidated map, keep the higher quantity
              if (consolidatedItems.has(itemKey)) {
                const existingItem = consolidatedItems.get(itemKey);
                if (remainingQuantity > existingItem.remainingQuantity) {
                  consolidatedItems.set(itemKey, {
                    ...item,
                    remainingQuantity: remainingQuantity,
                    originalOrders: [...existingItem.originalOrders, { 
                      orderId: order.id || order.date,
                      quantity: remainingQuantity
                    }]
                  });
                }
              } else {
                // Add new item to consolidated map
                consolidatedItems.set(itemKey, {
                  ...item,
                  remainingQuantity: remainingQuantity,
                  originalOrders: [{ 
                    orderId: order.id || order.date,
                    quantity: remainingQuantity
                  }]
                });
              }
            }
          });
        });
        
        // Only add client if they have items to ship
        if (consolidatedItems.size > 0) {
          clientOrders[userId] = {
            items: Array.from(consolidatedItems.values()),
            originalOrders: ordersToProcess.map(o => o.id || o.date)
          };
        }
      }
    });
    
    return clientOrders;
  }

  // Add these functions to your admin.js file

// Function to load consolidated orders
function loadConsolidatedOrders() {
    const consolidatedContainer = document.getElementById('consolidated-orders-container');
    
    // Show loading state
    consolidatedContainer.className = 'loading';
    
    // Fetch orders from server
    fetch('/api/admin/orders')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        // Generate consolidated shipping orders
        const consolidatedOrders = generateConsolidatedOrders(data);
        
        // Render consolidated orders
        consolidatedContainer.className = '';
        if (Object.keys(consolidatedOrders).length === 0) {
          consolidatedContainer.innerHTML = '<div class="no-orders">No pending shipments found</div>';
        } else {
          const consolidatedHtml = Object.entries(consolidatedOrders).map(([clientId, orderData]) => {
            return createConsolidatedOrderCard(clientId, orderData);
          }).join('');
          
          consolidatedContainer.innerHTML = `
            <div class="alert alert-info">
              <i class="fas fa-info-circle"></i> This view consolidates all pending shipments by client. For duplicate products, the higher quantity is shown.
            </div>
            <div class="consolidated-orders">
              ${consolidatedHtml}
            </div>
            <div class="refresh-action">
              <button class="btn btn-secondary" onclick="loadConsolidatedOrders()">
                <i class="fas fa-sync-alt"></i> Refresh Orders
              </button>
            </div>
          `;
          
          // Add event listeners for processing buttons
          document.querySelectorAll('.process-consolidated-btn').forEach(button => {
            button.addEventListener('click', function() {
              const clientId = this.getAttribute('data-client-id');
              toggleConsolidatedProcessingForm(clientId);
            });
          });
          
          document.querySelectorAll('.complete-consolidated-btn').forEach(button => {
            button.addEventListener('click', function() {
              const clientId = this.getAttribute('data-client-id');
              processConsolidatedShipment(clientId, consolidatedOrders[clientId].items);
            });
          });
        }
      })
      .catch(error => {
        console.error('Error:', error);
        consolidatedContainer.className = '';
        consolidatedContainer.innerHTML = `<div class="no-orders">Error loading orders: ${error.message}</div>`;
        showNotification('Error loading orders: ' + error.message, 'error');
      });
  }
  
  // Function to generate consolidated orders
  function generateConsolidatedOrders(orderData) {
    const clientOrders = {};
    
    // Group orders by client
    Object.entries(orderData).forEach(([userId, orders]) => {
      // Filter out orders that have items that need to be shipped
      const ordersToProcess = orders.filter(order => {
        return order.status === 'partially_shipped' || order.status === 'in progress';
      });
      
      if (ordersToProcess.length > 0) {
        // Initialize consolidated items map to track highest quantities
        const consolidatedItems = new Map();
        
        // Process each order
        ordersToProcess.forEach(order => {
          order.items.forEach(item => {
            // Calculate remaining quantity to ship
            const shippedQuantity = item.shipped || 0;
            const remainingQuantity = item.quantity - shippedQuantity;
            
            if (remainingQuantity > 0) {
              const itemKey = `${item.Nom}-${item.categorie}`;
              
              // If item already exists in consolidated map, keep the higher quantity
              if (consolidatedItems.has(itemKey)) {
                const existingItem = consolidatedItems.get(itemKey);
                if (remainingQuantity > existingItem.remainingQuantity) {
                  consolidatedItems.set(itemKey, {
                    ...item,
                    remainingQuantity: remainingQuantity,
                    originalOrders: [...existingItem.originalOrders, { 
                      orderId: order.id || order.date,
                      quantity: remainingQuantity
                    }]
                  });
                }
              } else {
                // Add new item to consolidated map
                consolidatedItems.set(itemKey, {
                  ...item,
                  remainingQuantity: remainingQuantity,
                  originalOrders: [{ 
                    orderId: order.id || order.date,
                    quantity: remainingQuantity
                  }]
                });
              }
            }
          });
        });
        
        // Only add client if they have items to ship
        if (consolidatedItems.size > 0) {
          clientOrders[userId] = {
            items: Array.from(consolidatedItems.values()),
            originalOrders: ordersToProcess.map(o => o.id || o.date)
          };
        }
      }
    });
    
    return clientOrders;
  }
  
  // Function to create an order card for consolidated shipments
  function createConsolidatedOrderCard(clientId, orderData) {
    // Calculate total
    const total = orderData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.prix) * item.remainingQuantity);
    }, 0).toFixed(2);
    
    // Create HTML for order items
    const itemsHtml = orderData.items.map(item => {
      const itemTotal = (item.remainingQuantity * parseFloat(item.prix)).toFixed(2);
      return `
        <tr>
          <td>${item.Nom}</td>
          <td>${item.categorie}</td>
          <td class="text-center">${item.remainingQuantity}</td>
          <td>${item.prix} CHF</td>
          <td>${itemTotal} CHF</td>
        </tr>
      `;
    }).join('');
    
    // Create HTML for processing form items
    const formItemsHtml = orderData.items.map(item => {
      return `
        <div class="form-row">
          <div class="item-name">${item.Nom}</div>
          <div class="ordered-qty">${item.remainingQuantity}</div>
          <div class="shipped-qty">
            <input id="shipped-${clientId}-${item.Nom.replace(/ /g, '-')}" 
                   type="number" 
                   min="0" 
                   max="${item.remainingQuantity}" 
                   value="${item.remainingQuantity}" />
          </div>
        </div>
      `;
    }).join('');
    
    // Create the card HTML
    return `
      <div class="order-card consolidated-order" data-client-id="${clientId}">
        <div class="order-header">
          <div class="order-id">Client: ${clientId}</div>
          <div class="order-status status-partial">Consolidated Shipment</div>
        </div>
        
        <div class="customer-info">
          <div><strong>Items to ship:</strong> ${orderData.items.length}</div>
          <div><strong>Original orders:</strong> ${orderData.originalOrders.length}</div>
        </div>
        
        <table class="order-items">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>To Ship</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="order-total">
          Total: ${total} CHF
        </div>
        
        <div class="order-actions">
          <button class="btn btn-primary process-consolidated-btn" data-client-id="${clientId}">
            Process Consolidated Shipment
          </button>
        </div>
        
        <div class="processing-form" id="processing-form-${clientId}">
          <h4>Process Consolidated Shipment</h4>
          <div class="form-header form-row">
            <div class="item-name"><strong>Product</strong></div>
            <div class="ordered-qty"><strong>To Ship</strong></div>
            <div class="shipped-qty"><strong>Ship Now</strong></div>
          </div>
          
          ${formItemsHtml}
          
          <div class="form-actions">
            <button class="btn btn-secondary cancel-consolidated-btn" data-client-id="${clientId}">
              Cancel
            </button>
            <button class="btn btn-success complete-consolidated-btn" data-client-id="${clientId}">
              Complete Shipment
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  // Function to toggle processing form visibility
  function toggleConsolidatedProcessingForm(clientId) {
    const processingForm = document.getElementById(`processing-form-${clientId}`);
    
    // Close all other open forms
    document.querySelectorAll('.processing-form.active').forEach(form => {
      if (form.id !== `processing-form-${clientId}`) {
        form.classList.remove('active');
      }
    });
    
    // Toggle this form
    processingForm.classList.toggle('active');
    
    // Add event listener to cancel button if form is active
    if (processingForm.classList.contains('active')) {
      const cancelBtn = processingForm.querySelector('.cancel-consolidated-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
          processingForm.classList.remove('active');
        });
      }
    }
  }
  
  // Function to process consolidated shipment
  function processConsolidatedShipment(clientId, items) {
    // Group items by original order
    const orderItemsMap = new Map();
    
    // Get consolidated order data from the DOM
    const orderCard = document.querySelector(`.order-card[data-client-id="${clientId}"]`);
    
    // Get all original order IDs (stored as data attribute)
    const originalOrderIds = Array.from(orderCard.querySelectorAll('[data-original-order-id]'))
      .map(el => el.getAttribute('data-original-order-id'));
    
    // Initialize with all original orders
    originalOrderIds.forEach(orderId => {
      orderItemsMap.set(orderId, []);
    });
    
    // Assign items to their original orders
    items.forEach(item => {
      item.originalOrders.forEach(orderInfo => {
        const items = orderItemsMap.get(orderInfo.orderId) || [];
        // Get the input value for this item
        const inputElement = document.getElementById(`shipped-${clientId}-${item.Nom.replace(/ /g, '-')}`);
        const shippedQty = parseInt(inputElement.value);
        
        if (shippedQty > 0) {
          items.push({
            name: item.Nom,
            orderedQty: orderInfo.quantity,
            shippedQty: shippedQty
          });
          orderItemsMap.set(orderInfo.orderId, items);
        }
      });
    });
    
    // Process each order update
    const promises = [];
    
    orderItemsMap.forEach((orderItems, orderId) => {
      if (orderItems.length > 0) {
        const promise = fetch('/api/update-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            orderId: orderId,
            userId: clientId,
            items: orderItems,
            status: 'partially_shipped'
          })
        });
        
        promises.push(promise);
      }
    });
    
    // Wait for all order updates to complete
    Promise.all(promises)
      .then(responses => {
        // Check if all responses are ok
        const allSuccessful = responses.every(response => response.ok);
        if (!allSuccessful) {
          throw new Error('One or more order updates failed');
        }
        
        showNotification('Orders processed successfully', 'success');
        
        // Hide the processing form
        document.getElementById(`processing-form-${clientId}`).classList.remove('active');
        
        // Reload orders
        loadConsolidatedOrders();
        loadOrders(); // Also reload regular orders
      })
      .catch(error => {
        console.error('Error processing orders:', error);
        showNotification('Error processing orders: ' + error.message, 'error');
      });
  }