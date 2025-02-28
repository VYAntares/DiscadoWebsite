document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
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
        }
      });
    });
    
    // Load orders initially
    loadOrders();
    
    // Function to load orders
    function loadOrders() {
      const pendingContainer = document.getElementById('pending-orders-container');
      const completedContainer = document.getElementById('completed-orders-container');
      
      // Show loading state
      pendingContainer.className = 'loading';
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
          const completedOrders = [];
          
          // Process each user's orders
          Object.entries(data).forEach(([userId, userOrders]) => {
            userOrders.forEach(order => {
              order.userId = userId;
              if (order.status === 'completed') {
                completedOrders.push(order);
              } else {
                pendingOrders.push(order);
              }
            });
          });
          
          // Sort orders by date, newest first
          pendingOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
          completedOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
          
          // Render pending orders
          pendingContainer.className = '';
          if (pendingOrders.length === 0) {
            pendingContainer.innerHTML = '<div class="no-orders">No pending orders</div>';
          } else {
            pendingContainer.innerHTML = pendingOrders.map(order => createOrderCard(order, true)).join('');
          }
          
          // Render completed orders
          completedContainer.className = '';
          if (completedOrders.length === 0) {
            completedContainer.innerHTML = '<div class="no-orders">No completed orders</div>';
          } else {
            completedContainer.innerHTML = completedOrders.map(order => createOrderCard(order, false)).join('');
          }
        })
        .catch(error => {
          console.error('Error:', error);
          pendingContainer.className = '';
          completedContainer.className = '';
          pendingContainer.innerHTML = `<div class="no-orders">Error loading orders: ${error.message}</div>`;
          completedContainer.innerHTML = '';
          showNotification('Error loading orders: ' + error.message, 'error');
        });
    }
    
    // Function to load customers
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
          // Render customers
          customersContainer.className = '';
          if (Object.keys(data).length === 0) {
            customersContainer.innerHTML = '<div class="no-orders">No customers found</div>';
          } else {
            const customersHtml = Object.entries(data).map(([userId, customerInfo]) => `
              <div class="customer-item">
                <div class="customer-header">
                  <div class="customer-name">${customerInfo.fullName || userId}</div>
                  <div class="customer-id">ID: ${userId}</div>
                </div>
                <div class="customer-details">
                  <div class="customer-detail">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${customerInfo.email || 'N/A'}</span>
                  </div>
                  <div class="customer-detail">
                    <span class="detail-label">Phone</span>
                    <span class="detail-value">${customerInfo.phone || 'N/A'}</span>
                  </div>
                  <div class="customer-detail">
                    <span class="detail-label">Address</span>
                    <span class="detail-value">${customerInfo.address || 'N/A'}</span>
                  </div>
                  <div class="customer-detail">
                    <span class="detail-label">City</span>
                    <span class="detail-value">${customerInfo.city || 'N/A'}, ${customerInfo.postalCode || ''}</span>
                  </div>
                </div>
              </div>
            `).join('');
            
            customersContainer.innerHTML = customersHtml;
          }
        })
        .catch(error => {
          console.error('Error:', error);
          customersContainer.className = '';
          customersContainer.innerHTML = `<div class="no-orders">Error loading customers: ${error.message}</div>`;
          showNotification('Error loading customers: ' + error.message, 'error');
        });
    }
  });
  
  // Function to create an order card
  function createOrderCard(order, isPending) {
    // Calculate total
    const total = order.items.reduce((sum, item) => sum + (parseFloat(item.prix) * item.quantity), 0).toFixed(2);
    
    // Format date
    const orderDate = new Date(order.date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Create HTML for order items
    const itemsHtml = order.items.map(item => `
      <tr>
        <td>${item.Nom}</td>
        <td>${item.categorie}</td>
        <td class="text-center">${item.quantity}</td>
        <td>${item.prix} CHF</td>
        <td>${(item.quantity * parseFloat(item.prix)).toFixed(2)} CHF</td>
      </tr>
    `).join('');
    
    // Create HTML for processing form items
    const formItemsHtml = order.items.map(item => `
      <div class="form-row">
        <div class="item-name">${item.Nom}</div>
        <div class="ordered-qty">${item.quantity}</div>
        <div class="shipped-qty">
          <input type="number" min="0" max="${item.quantity}" value="${item.shipped || 0}" />
        </div>
        ${item.shipped && item.shipped < item.quantity ? 
          `<div class="remaining-qty">Remaining: ${item.quantity - item.shipped}</div>` : ''}
      </div>
    `).join('');
    
    // Status badge
    const statusClass = order.status === 'completed' ? 'status-completed' : 'status-pending';
    const statusText = order.status === 'completed' ? 'Completed' : 
                       order.status === 'partially_shipped' ? 'Partially Shipped' : 'In Progress';
    
    // Create the card HTML
    return `
      <div class="order-card" data-order-id="${order.id || order.date}" data-user-id="${order.userId}">
        <div class="order-header">
          <div class="order-id">Order #${order.id || order.date.substring(0, 10)}</div>
          <div class="order-date">${orderDate}</div>
          <div class="order-status ${statusClass}">${statusText}</div>
        </div>
        
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
          Total: ${total} CHF
        </div>
        
        ${isPending ? `
          <div class="order-actions">
            <button class="btn btn-primary" onclick="processOrder('${order.id || order.date}', '${order.userId}')">
              Process Order
            </button>
          </div>
          
          <div class="processing-form">
            <h4>Process Order</h4>
            <div class="form-header form-row">
              <div class="item-name"><strong>Product</strong></div>
              <div class="ordered-qty"><strong>Ordered</strong></div>
              <div class="shipped-qty"><strong>Shipped</strong></div>
            </div>
            ${formItemsHtml}
            <div class="form-actions">
              <button class="btn btn-secondary" onclick="processOrder('${order.id || order.date}', '${order.userId}')">
                Cancel
              </button>
              <button class="btn btn-success" onclick="saveProcessedOrder('${order.id || order.date}', '${order.userId}')">
                Save & Complete
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Process order function
  function processOrder(orderId, userId) {
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
  function saveProcessedOrder(orderId, userId) {
    const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
    const processingForm = orderCard.querySelector('.processing-form');
    
    // Collect the shipped quantities
    const items = [];
    processingForm.querySelectorAll('.form-row').forEach(row => {
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
        location.reload();
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