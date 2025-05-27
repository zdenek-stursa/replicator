// Import modules
import { loadFormState, saveFormState, initializeStorageElements } from './modules/storage.js';
import { showError, toggleLoading, initializeUIElements } from './modules/ui.js';
import { loadGallery, initializeGalleryElements, getCurrentPage } from './modules/gallery.js';
import { applyParamValue, initializeFormGeneratorElements, parseRatio } from './modules/form-generator.js';
import { loadModels, loadModelParams, generateImage, improvePrompt, deleteImage, initializeAPIClientElements } from './modules/api-client.js';
import { openImageModal, closeImageModal, showModalImage, initializeModalElements, getCurrentModalIndex } from './modules/modal-navigation.js';

// Global state
let isGenerating = false;




// DOM Elements
const $form = $('#generationForm');
const $prompt = $('#prompt');
const $modelSelect = $('#modelSelect');
const $modelParamsContainer = $('#modelParamsContainer');
const $generateBtn = $('#generateBtn');
const $improveBtn = $('#improvePrompt');
const $clearBtn = $('#clearPrompt');
const $gallery = $('#imageGallery');
const $pagination = $('#galleryPagination');
const $spinner = $('#spinnerOverlay');
const errorModal = new bootstrap.Modal('#errorModal');
const deleteModal = new bootstrap.Modal('#deleteModal');
const $imageModal = $('#imageModal');
const $modalImage = $('#modalImage');
const $modalNavPrev = $('.modal-nav-prev');
const $modalNavNext = $('.modal-nav-next');






// Initialize modules with DOM elements
function initializeModules() {
    initializeStorageElements($prompt, $modelSelect);
    initializeUIElements($spinner, $generateBtn, $improveBtn, $clearBtn, errorModal);
    initializeGalleryElements($gallery, $pagination);
    initializeFormGeneratorElements($modelParamsContainer);
    initializeAPIClientElements($prompt, $modelSelect, $modelParamsContainer);
    initializeModalElements($imageModal, $modalImage, $gallery);
}

// Application initialization
$(document).ready(async () => {
    // Initialize all modules
    initializeModules();

    // Load initial data
    const models = await loadModels();
    if (models) {
        // Try to select previously saved model
        const savedModel = loadFormState();
        if (savedModel && models.includes(savedModel)) {
            $modelSelect.val(savedModel);
            await loadModelParams(savedModel);
        }
    }

    loadGallery(); // Load initial gallery view

    // Form submission
    $form.on('submit', async (e) => {
        e.preventDefault();
        if (isGenerating) return;

        const prompt = $prompt.val().trim();
        const modelId = $modelSelect.val();
        const parameters = {};

        // Collect dynamic parameters
        $modelParamsContainer.find('.model-param').each(function() {
            const $input = $(this);
            const name = $input.attr('name');
            let value;

            if ($input.is(':checkbox')) {
                value = $input.is(':checked');
            } else if ($input.is('input[type="number"]') || $input.is('input[type="range"]')) {
                value = parseFloat($input.val());
                if (isNaN(value)) {
                   console.warn(`Invalid number value for ${name}: ${$input.val()}`);
                   return;
                }
            } else {
                value = $input.val();
            }

            if (name && value !== undefined && value !== null && value !== '') {
                parameters[name] = value;
            }
        });

        if (!prompt) {
            showError('Please enter a prompt to generate an image.');
            return;
        }
        if (!modelId) {
            showError('Please select a model for generation.');
            return;
        }

        saveFormState();
        isGenerating = true;
        await generateImage(prompt, modelId, parameters);
        isGenerating = false;
    });

    // Model selection change
    $modelSelect.on('change', function() {
        const selectedModelId = $(this).val();
        loadModelParams(selectedModelId);
        saveFormState();
    });

    // Improve prompt button
    $improveBtn.on('click', async () => {
        const prompt = $prompt.val().trim();
        if (!prompt) {
            showError('Please enter a prompt to improve.');
            return;
        }
        await improvePrompt(prompt);
    });

    // Clear prompt button
    $clearBtn.on('click', () => {
        $prompt.val('');
        saveFormState();
    });

    // Pagination clicks
    $pagination.on('click', '.page-link', async (e) => {
        e.preventDefault();
        const page = $(e.currentTarget).data('page');
        if (page && page !== getCurrentPage()) {
            await loadGallery(page);
        }
    });

    // Delete functionality
    let imageToDelete = null;

    $gallery.on('click', '.delete-image', (e) => {
        const imageId = $(e.currentTarget).data('image-id');
        imageToDelete = imageId.replace(/\.(webp|png)$/, '');
        deleteModal.show();
    });

    $('#confirmDelete').on('click', async () => {
        if (imageToDelete) {
            await deleteImage(imageToDelete);
            deleteModal.hide();
            imageToDelete = null;
        }
    });

    // Copy settings functionality
    $gallery.on('click', '.copy-settings', async (e) => {
        const imageId = $(e.currentTarget).data('image-id');
        const cleanImageId = imageId.replace(/\.(webp|png)$/, '');
        try {
            toggleLoading(true);
            const response = await fetch(`/api/metadata/${cleanImageId}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Unknown error');

            // Set prompt and model
            $prompt.val(data.original_prompt || data.prompt || '');
            const modelIdToSelect = data.model_id;

            if (modelIdToSelect && $modelSelect.find(`option[value="${modelIdToSelect}"]`).length) {
                $modelSelect.val(modelIdToSelect);
                await loadModelParams(modelIdToSelect);

                // Apply saved parameters
                if (data.parameters) {
                    const parameters = data.parameters || {};
                    for (const [key, value] of Object.entries(parameters)) {
                         if (key === 'width' || key === 'height') continue;
                         applyParamValue(key, value);
                    }

                    // Handle aspect ratio
                    const $aspectSelect = $('#aspectRatioSelect');
                    if ($aspectSelect.length > 0 && parameters.width && parameters.height) {
                        const metaWidth = parseFloat(parameters.width);
                        const metaHeight = parseFloat(parameters.height);
                        if (!isNaN(metaWidth) && !isNaN(metaHeight) && metaHeight !== 0) {
                            const actualRatio = metaWidth / metaHeight;
                            let matched = false;
                            $aspectSelect.find('option').each(function() {
                                const optionVal = $(this).val();
                                if (optionVal !== 'custom') {
                                    const optionRatio = parseRatio(optionVal);
                                    if (Math.abs(actualRatio - optionRatio) < 0.01) {
                                        $aspectSelect.val(optionVal);
                                        matched = true;
                                        return false;
                                    }
                                }
                            });
                            if (!matched) {
                                $aspectSelect.val('custom');
                            }
                        } else {
                            $aspectSelect.val('custom');
                        }
                        $aspectSelect.trigger('change');
                        applyParamValue('width', metaWidth);
                        applyParamValue('height', metaHeight);
                    } else {
                         applyParamValue('width', parameters.width);
                         applyParamValue('height', parameters.height);
                    }
                }
            } else {
                console.warn(`Model ${modelIdToSelect} from metadata not found in select options.`);
                $modelParamsContainer.empty();
            }

            saveFormState();

        } catch (error) {
            showError('Error copying settings: ' + error.message);
            $modelParamsContainer.empty();
        } finally {
            toggleLoading(false);
        }
    });

    // Download image
    $gallery.on('click', '.download-image', (e) => {
        const imagePath = $(e.currentTarget).data('image-path');
        const link = document.createElement('a');
        link.href = imagePath;
        link.download = imagePath.split('/').pop();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Image modal functionality
    $gallery.off('click', '.card-img-top').on('click', '.card-img-top', function(e) {
        e.stopPropagation();
        const imageSrc = $(this).attr('src');
        openImageModal(imageSrc);
    });

    // Modal navigation
    $modalNavPrev.off('click').on('click', (e) => {
        e.stopPropagation();
        showModalImage(getCurrentModalIndex() - 1);
    });

    $modalNavNext.off('click').on('click', (e) => {
        e.stopPropagation();
        showModalImage(getCurrentModalIndex() + 1);
    });

    // Close modal
    $imageModal.off('click').on('click', function(e) {
        if (!$(e.target).closest('.modal-nav').length && !$(e.target).closest('.modal-close').length) {
            closeImageModal();
        }
    });

    $('.modal-close').off('click').on('click', function(e) {
         e.stopPropagation();
         closeImageModal();
    });

    // Form input changes
    $prompt.on('change input', saveFormState);

    // Range slider display updates
    $modelParamsContainer.on('input', 'input[type="range"]', function() {
        $(this).siblings('.range-value').text($(this).val());
    });
});