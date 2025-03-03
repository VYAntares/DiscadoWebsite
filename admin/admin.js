// Admin Panel Main Script
document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Ensure Orders tab is active by default
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Get the Orders tab button and content
    const ordersTabBtn = document.querySelector('.tab-btn[data-tab="orders"]');
    const ordersTabContent = document.getElementById('orders-tab');
    
    // Activate Orders tab
    if (ordersTabBtn) ordersTabBtn.classList.add('active');
    if (ordersTabContent) ordersTabContent.classList.add('active');
    
    // Load orders data
    if (typeof loadPendingOrders === 'function') {
        loadPendingOrders();
    }
    
    // Add click event listeners to tab buttons
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Show corresponding content
            const tabId = this.getAttribute('data-tab');
            const tabContent = document.getElementById(`${tabId}-tab`);
            if (tabContent) {
                tabContent.classList.add('active');
            }
            
            // Load data if needed
            if (tabId === 'orders' && typeof loadPendingOrders === 'function') {
                loadPendingOrders();
            } else if (tabId === 'clients' && typeof loadClientData === 'function') {
                loadClientData();
            }
        });
    });
    
    // Modal functionality
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close-modal, .close-btn');
    
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            modals.forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Notification system
    window.showNotification = function(message, type = 'success') {
        const container = document.getElementById('notification-container');
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Icon based on type
        let icon = '✓';
        if (type === 'error') icon = '✕';
        if (type === 'info') icon = 'ℹ';
        
        // Notification structure
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                <div class="notification-message">${message}</div>
            </div>
            <div class="notification-progress">
                <div class="notification-progress-bar"></div>
            </div>
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Remove after animation
        setTimeout(() => {
            notification.remove();
        }, 4000);
    };
});