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

// Disable/enable body scroll
function disableBodyScroll() {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${window.scrollY}px`;
}

function enableBodyScroll() {
    const scrollY = document.body.style.top;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
}

// Improve dropdown positioning for mobile
export function improveMobileDropdownPositioning() {
    if (!isMobileDevice()) return;

    // Override Bootstrap's dropdown positioning for mobile
    document.addEventListener('shown.bs.dropdown', function(event) {
        if (!isMobileDevice()) return;

        const dropdown = event.target.closest('.dropdown');
        const dropdownMenu = dropdown?.querySelector('.dropdown-menu');
        const imageCard = dropdown?.closest('.image-card');

        if (dropdown && dropdownMenu && imageCard) {
            // Disable body scroll when dropdown opens
            disableBodyScroll();

            // Get image card position and dimensions
            const cardRect = imageCard.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const menuHeight = 180; // Approximate height of 3 items

            // Calculate optimal position
            let top, bottom;
            const spaceAbove = cardRect.top;
            const spaceBelow = viewportHeight - cardRect.bottom;

            // Position above the image card if there's enough space, otherwise below
            if (spaceAbove >= menuHeight + 20) {
                // Position above the card
                bottom = viewportHeight - cardRect.top + 10;
                top = 'auto';
            } else if (spaceBelow >= menuHeight + 20) {
                // Position below the card
                top = cardRect.bottom + 10;
                bottom = 'auto';
            } else {
                // Center vertically if neither position has enough space
                top = Math.max(20, (viewportHeight - menuHeight) / 2);
                bottom = 'auto';
            }

            // Calculate horizontal position (center relative to card)
            const cardCenterX = cardRect.left + cardRect.width / 2;
            const menuWidth = 280;
            let left = cardCenterX - menuWidth / 2;

            // Ensure menu doesn't go off screen
            const margin = 20;
            if (left < margin) {
                left = margin;
            } else if (left + menuWidth > window.innerWidth - margin) {
                left = window.innerWidth - menuWidth - margin;
            }

            // Apply positioning
            dropdownMenu.style.position = 'fixed';
            dropdownMenu.style.top = top === 'auto' ? 'auto' : `${top}px`;
            dropdownMenu.style.bottom = bottom === 'auto' ? 'auto' : `${bottom}px`;
            dropdownMenu.style.left = `${left}px`;
            dropdownMenu.style.transform = 'none';
            dropdownMenu.style.width = `${menuWidth}px`;
            dropdownMenu.style.maxWidth = `calc(100vw - ${margin * 2}px)`;
            dropdownMenu.style.margin = '0';
            dropdownMenu.style.zIndex = '1060';
        }
    });

    // Re-enable body scroll when dropdown closes
    document.addEventListener('hidden.bs.dropdown', function(event) {
        if (!isMobileDevice()) return;

        const dropdown = event.target.closest('.dropdown');
        if (dropdown && dropdown.closest('.image-card')) {
            enableBodyScroll();
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
