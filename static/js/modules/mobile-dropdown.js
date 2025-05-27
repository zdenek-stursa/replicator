// Mobile dropdown enhancement for better touch experience

// Check if device is mobile
function isMobileDevice() {
    return window.innerWidth <= 767.98;
}

// Initialize mobile dropdown enhancements
export function initializeMobileDropdown() {
    if (!isMobileDevice()) return;
    
    const backdrop = document.getElementById('mobileDropdownBackdrop');
    if (!backdrop) return;
    
    // Handle dropdown show/hide events
    document.addEventListener('shown.bs.dropdown', function(event) {
        if (!isMobileDevice()) return;
        
        const dropdown = event.target.closest('.dropdown');
        const dropdownMenu = dropdown?.querySelector('.dropdown-menu');
        
        if (dropdown && dropdownMenu && dropdown.closest('.image-card')) {
            // Show backdrop
            backdrop.style.display = 'block';
            
            // Add click handler to backdrop
            const closeDropdown = () => {
                const dropdownToggle = dropdown.querySelector('.dropdown-toggle');
                if (dropdownToggle) {
                    // Use Bootstrap's dropdown API to hide
                    const bsDropdown = bootstrap.Dropdown.getInstance(dropdownToggle);
                    if (bsDropdown) {
                        bsDropdown.hide();
                    }
                }
            };
            
            backdrop.addEventListener('click', closeDropdown, { once: true });
            
            // Prevent dropdown from closing when clicking inside menu
            dropdownMenu.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            
            // Add escape key handler
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    closeDropdown();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
    });
    
    // Handle dropdown hide events
    document.addEventListener('hidden.bs.dropdown', function(event) {
        if (!isMobileDevice()) return;
        
        const dropdown = event.target.closest('.dropdown');
        if (dropdown && dropdown.closest('.image-card')) {
            // Hide backdrop
            backdrop.style.display = 'none';
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        // Hide backdrop if switching to desktop
        if (!isMobileDevice()) {
            backdrop.style.display = 'none';
        }
    });
}

// Enhanced touch handling for dropdown items
export function enhanceDropdownTouchHandling() {
    document.addEventListener('touchstart', function(e) {
        if (!isMobileDevice()) return;
        
        const dropdownItem = e.target.closest('.dropdown-item');
        if (dropdownItem && dropdownItem.closest('.image-card')) {
            // Add visual feedback for touch
            dropdownItem.style.backgroundColor = '#404040';
        }
    }, { passive: true });
    
    document.addEventListener('touchend', function(e) {
        if (!isMobileDevice()) return;
        
        const dropdownItem = e.target.closest('.dropdown-item');
        if (dropdownItem && dropdownItem.closest('.image-card')) {
            // Remove visual feedback
            setTimeout(() => {
                dropdownItem.style.backgroundColor = '';
            }, 150);
        }
    }, { passive: true });
    
    document.addEventListener('touchcancel', function(e) {
        if (!isMobileDevice()) return;
        
        const dropdownItem = e.target.closest('.dropdown-item');
        if (dropdownItem && dropdownItem.closest('.image-card')) {
            // Remove visual feedback
            dropdownItem.style.backgroundColor = '';
        }
    }, { passive: true });
}

// Improve dropdown positioning for mobile
export function improveMobileDropdownPositioning() {
    if (!isMobileDevice()) return;
    
    // Override Bootstrap's dropdown positioning for mobile
    document.addEventListener('shown.bs.dropdown', function(event) {
        if (!isMobileDevice()) return;
        
        const dropdown = event.target.closest('.dropdown');
        const dropdownMenu = dropdown?.querySelector('.dropdown-menu');
        
        if (dropdown && dropdownMenu && dropdown.closest('.image-card')) {
            // Force the positioning we want for mobile
            dropdownMenu.style.position = 'fixed';
            dropdownMenu.style.top = 'auto';
            dropdownMenu.style.left = '50%';
            dropdownMenu.style.bottom = '20px';
            dropdownMenu.style.transform = 'translateX(-50%)';
            dropdownMenu.style.width = '280px';
            dropdownMenu.style.maxWidth = '90vw';
            dropdownMenu.style.margin = '0';
        }
    });
}

// Initialize all mobile dropdown enhancements
export function initializeAllMobileDropdownEnhancements() {
    initializeMobileDropdown();
    enhanceDropdownTouchHandling();
    improveMobileDropdownPositioning();
}

// Export individual functions for flexibility
export { isMobileDevice };
