// Mobile optimizations for admin.js

document.addEventListener('DOMContentLoaded', function() {
    // Detect if we're on a mobile device
    const isMobile = window.innerWidth <= 768;
    
    // Apply mobile-specific tweaks
    if (isMobile) {
      // Add wrapper for tables to allow horizontal scrolling if needed
      document.querySelectorAll('.order-items').forEach(table => {
        // Only if not already wrapped
        if (!table.parentElement.classList.contains('order-items-container')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'order-items-container';
          table.parentNode.insertBefore(wrapper, table);
          wrapper.appendChild(table);
        }
      });
      
      // Simplify the order tables on mobile
      function simplifyOrderTablesForMobile() {
        // For tables that exist now
        processExistingTables();
        
        // For tables that will be added later (after loading orders)
        const observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
              processExistingTables();
            }
          });
        });
        
        // Observe the containers where tables might be added
        const containers = [
          document.getElementById('pending-orders-container'),
          document.getElementById('partial-orders-container'),
          document.getElementById('completed-orders-container')
        ];
        
        containers.forEach(container => {
          if (container) {
            observer.observe(container, { childList: true, subtree: true });
          }
        });
      }
      
      function processExistingTables() {
        document.querySelectorAll('.order-items').forEach(table => {
          // Skip tables already processed
          if (table.hasAttribute('data-mobile-processed')) return;
          
          // Add data attributes for better mobile display
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 5) {
              // Add data attributes for better semantic understanding
              cells[0].setAttribute('data-label', 'Product');
              cells[1].setAttribute('data-label', 'Category');
              cells[2].setAttribute('data-label', 'Quantity');
              cells[3].setAttribute('data-label', 'Price');
              cells[4].setAttribute('data-label', 'Total');
            }
          });
          
          // Mark as processed
          table.setAttribute('data-mobile-processed', 'true');
        });
      }
      
      // Enhance form-rows for mobile view
      function enhanceFormRowsForMobile() {
        document.querySelectorAll('.form-row').forEach(row => {
          // Skip rows already processed
          if (row.hasAttribute('data-mobile-processed')) return;
          
          // Add data attributes for label/value relationship
          const itemName = row.querySelector('.item-name');
          const orderedQty = row.querySelector('.ordered-qty');
          const shippedQty = row.querySelector('.shipped-qty');
          
          if (itemName && orderedQty && shippedQty) {
            itemName.setAttribute('aria-label', 'Product');
            orderedQty.setAttribute('aria-label', 'Ordered');
            shippedQty.setAttribute('aria-label', 'Ship Now');
          }
          
          // Mark as processed
          row.setAttribute('data-mobile-processed', 'true');
        });
      }
      
      // Call these functions initially and add listeners to handle dynamic content
      simplifyOrderTablesForMobile();
      enhanceFormRowsForMobile();
      
      // Monitor form visibility changes to enhance newly visible forms
      document.addEventListener('click', function(e) {
        // If this might be a button that shows a form
        if (e.target.tagName === 'BUTTON') {
          // Wait a moment for the form to become visible
          setTimeout(enhanceFormRowsForMobile, 100);
        }
      });
      
      // Improve mobile navigation experience
      const tabs = document.querySelectorAll('.tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', function() {
          // Scroll to the top of the content when changing tabs
          window.scrollTo(0, 0);
        });
      });
    }
    
    // Function to adapt layout based on screen size changes
    function handleResize() {
      const width = window.innerWidth;
      const orderItems = document.querySelectorAll('.order-items');
      
      // Apply specific layout changes based on screen width
      if (width <= 414) { // iPhone size
        // Add specific iPhone class if not already present
        document.body.classList.add('iphone-view');
        
        // Collapse order header if needed
        document.querySelectorAll('.order-header').forEach(header => {
          header.classList.add('compact');
        });
      } else {
        // Remove iPhone-specific classes when screen is larger
        document.body.classList.remove('iphone-view');
        
        document.querySelectorAll('.order-header').forEach(header => {
          header.classList.remove('compact');
        });
      }
    }
    
    // Call once on load
    handleResize();
    
    // Set up resize listener with debounce
    let resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 250);
    });
  });