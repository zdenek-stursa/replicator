// PhotoSwipe gallery functionality

// DOM Elements (will be initialized in main.js)
let $gallery;

// Initialize DOM references
export function initializePhotoSwipeElements(galleryElement) {
    $gallery = galleryElement;
}

// Function to get image dimensions
function getImageDimensions(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            resolve({ width: this.naturalWidth, height: this.naturalHeight });
        };
        img.onerror = function() {
            // Fallback to default dimensions if image fails to load
            resolve({ width: 1024, height: 1024 });
        };
        img.src = src;
    });
}

// Function to open PhotoSwipe gallery
export async function openPhotoSwipeGallery(clickedImageSrc) {
    if (!$gallery) {
        console.warn('Gallery element not initialized');
        return;
    }

    // Collect all images from the current gallery view
    const galleryImages = [];
    let clickedIndex = 0;
    const imagePromises = [];

    $gallery.find('.card-img-top').each(function(index) {
        const $img = $(this);
        const src = $img.attr('src');
        const alt = $img.attr('alt') || 'Generated image';

        // Extract filename from src for comparison
        const filename = src.split('/').pop();
        const clickedFilename = clickedImageSrc.split('/').pop();

        if (filename === clickedFilename) {
            clickedIndex = index;
        }

        // Create promise to get image dimensions
        const imagePromise = getImageDimensions(src).then(dimensions => ({
            src: src,
            width: dimensions.width,
            height: dimensions.height,
            alt: alt
        }));

        imagePromises.push(imagePromise);
    });

    if (imagePromises.length === 0) {
        console.warn('No images found in gallery');
        return;
    }

    try {
        // Wait for all image dimensions to be loaded
        const resolvedImages = await Promise.all(imagePromises);

        // Create PhotoSwipe options
        const options = {
            dataSource: resolvedImages,
            index: clickedIndex,
            bgOpacity: 0.9,
            showHideAnimationType: 'fade',

            // Enable zoom to actual size
            maxZoomLevel: 3,

            // Close on click outside
            clickToCloseNonZoomable: true,

            // UI elements titles
            closeTitle: 'Close (Esc)',
            zoomTitle: 'Zoom in/out',
            arrowPrevTitle: 'Previous (arrow left)',
            arrowNextTitle: 'Next (arrow right)'
        };

        // Initialize and open PhotoSwipe
        const pswp = new PhotoSwipe(options);

        // Open the lightbox
        pswp.init();

    } catch (error) {
        console.error('Error initializing PhotoSwipe:', error);
        // Fallback: open image in new tab
        window.open(clickedImageSrc, '_blank');
    }
}

// Function to check if PhotoSwipe is available
export function isPhotoSwipeAvailable() {
    return typeof PhotoSwipe !== 'undefined';
}
