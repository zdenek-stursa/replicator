// Gallery management functions

import { showError } from './ui.js';

// DOM Elements (will be initialized in main.js)
let $gallery, $pagination;

// Global state
let currentPage = 1;

// Initialize DOM references
export function initializeGalleryElements(galleryElement, paginationElement) {
    $gallery = galleryElement;
    $pagination = paginationElement;
}

// Set current page
export function setCurrentPage(page) {
    currentPage = page;
}

// Get current page
export function getCurrentPage() {
    return currentPage;
}

// Create image card
export function createImageCard(image) {
    return `
        <div class="col-md-4 col-lg-3 mb-4">
            <div class="card image-card">
                <div class="ambient-background" style="background-image: url('/images/${image.image_filename}')"></div>
                <img src="/images/${image.image_filename}" class="card-img-top" alt="Generated image">
                <div class="overlay">
                    <div class="d-flex justify-content-between">
                        <button class="btn btn-sm btn-outline-light copy-settings" data-image-id="${image.image_filename}" title="Copy settings">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-light download-image" data-image-path="/images/${image.image_filename}" title="Download image">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-image" data-image-id="${image.image_filename}" title="Delete image">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Create pagination
export function createPagination(totalPages) {
    let html = '';

    // Previous button
    html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}">
                <i class="fas fa-chevron-left"></i>
            </a>
        </li>
    `;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        html += `
            <li class="page-item ${currentPage === i ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }

    // Next button
    html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}">
                <i class="fas fa-chevron-right"></i>
            </a>
        </li>
    `;

    return html;
}

// Load gallery images
export async function loadGallery(page = 1) {
    if (!$gallery || !$pagination) {
        console.warn('Gallery elements not initialized');
        return;
    }

    try {
        const response = await fetch(`/api/images?page=${page}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        $gallery.empty();
        data.images.forEach(image => {
            $gallery.append(createImageCard(image));
        });

        setCurrentPage(page);
        $pagination.html(createPagination(data.total_pages));

    } catch (error) {
        showError('Error loading gallery: ' + error.message);
    }
}
