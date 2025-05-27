// Modal navigation functionality

import { SWIPE_THRESHOLD } from './constants.js';

// DOM Elements (will be initialized in main.js)
let $imageModal, $modalImage, $gallery;

// Modal state
let modalImages = []; // Array to store image filenames for modal navigation
let currentModalIndex = -1; // Index of the currently displayed image in the modal

// Touch navigation state
let touchStartX = 0;
let touchEndX = 0;

// Initialize DOM references
export function initializeModalElements(imageModalElement, modalImageElement, galleryElement) {
    $imageModal = imageModalElement;
    $modalImage = modalImageElement;
    $gallery = galleryElement;
}

// Function to show specific image in modal
export function showModalImage(index) {
    if (modalImages.length === 0) return; // No images to show

    // Handle index wrapping
    currentModalIndex = (index + modalImages.length) % modalImages.length;

    const imageFilename = modalImages[currentModalIndex];
    $modalImage.attr('src', `/images/${imageFilename}`);
}

// Function to open the image modal
export function openImageModal(clickedImageSrc) {
    if (!$imageModal || !$modalImage || !$gallery) {
        console.warn('Modal elements not initialized');
        return;
    }
    
    // Populate modalImages from the current gallery view
    modalImages = [];
    $gallery.find('.card-img-top').each(function() {
        // Extract filename from src: "/images/filename.webp" -> "filename.webp"
        const src = $(this).attr('src');
        const filename = src.split('/').pop();
        if (filename) {
            modalImages.push(filename);
        }
    });

    // Find the index of the clicked image
    const clickedFilename = clickedImageSrc.split('/').pop();
    currentModalIndex = modalImages.findIndex(filename => filename === clickedFilename);

    if (currentModalIndex === -1) {
        console.error("Clicked image not found in current gallery list.");
        // Fallback: just show the clicked image without navigation
        $modalImage.attr('src', clickedImageSrc);
        modalImages = [clickedFilename]; // Set only the clicked one
        currentModalIndex = 0;
    } else {
        showModalImage(currentModalIndex); // Show the clicked image using the new function
    }

    $imageModal.css('display', 'flex'); // Show the modal
    $('body').css('overflow', 'hidden'); // Hide body scrollbars

    // Add keyboard listener when modal opens
    $(document).on('keydown.modalNav', handleModalKeydown);
    // Add touch listeners when modal opens
    $imageModal.on('touchstart.modalNav', handleTouchStart);
    $imageModal.on('touchmove.modalNav', handleTouchMove);
    $imageModal.on('touchend.modalNav', handleTouchEnd);
}

// Function to close the image modal
export function closeImageModal() {
    if (!$imageModal || !$modalImage) {
        console.warn('Modal elements not initialized');
        return;
    }
    
    $imageModal.css('display', 'none');
    $('body').css('overflow', ''); // Restore body scrollbars
    $modalImage.attr('src', ''); // Clear image source
    modalImages = []; // Clear the image list
    currentModalIndex = -1;
    // Remove listeners when modal closes
    $(document).off('keydown.modalNav');
    $imageModal.off('touchstart.modalNav touchmove.modalNav touchend.modalNav');
}

// Event Handlers for Navigation
// Keyboard Navigation
function handleModalKeydown(e) {
    if ($imageModal.css('display') === 'flex') { // Only act if modal is visible
        if (e.key === 'ArrowLeft') {
            e.preventDefault(); // Prevent browser back navigation if modal is focused
            showModalImage(currentModalIndex - 1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault(); // Prevent default scroll
            showModalImage(currentModalIndex + 1);
        } else if (e.key === 'Escape') {
            closeImageModal();
        }
    }
}

// Touch Navigation (Swipe)
function handleTouchStart(e) {
    touchStartX = e.originalEvent.touches[0].clientX;
    touchEndX = 0; // Reset end coordinate on new touch start
}

function handleTouchMove(e) {
    touchEndX = e.originalEvent.touches[0].clientX;
}

function handleTouchEnd() {
    if (touchStartX === 0 || touchEndX === 0) return; // Ensure move happened

    const deltaX = touchEndX - touchStartX;

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) { // Detect swipe
        if (deltaX > 0) {
            // Swipe Right (previous image)
            showModalImage(currentModalIndex - 1);
        } else {
            // Swipe Left (next image)
            showModalImage(currentModalIndex + 1);
        }
    }

    // Reset touch coordinates
    touchStartX = 0;
    touchEndX = 0;
}

// Get current modal index (for external navigation buttons)
export function getCurrentModalIndex() {
    return currentModalIndex;
}
