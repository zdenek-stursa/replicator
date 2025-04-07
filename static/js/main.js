// Form state management
const STORAGE_KEY = 'replicate-ai-form';
let currentPage = 1;
let isGenerating = false;
let modalImages = []; // Array to store image filenames for modal navigation
let currentModalIndex = -1; // Index of the currently displayed image in the modal

// DOM Elements
const $form = $('#generationForm');
const $prompt = $('#prompt');
const $modelSelect = $('#modelSelect'); // Changed ID
const $modelParamsContainer = $('#modelParamsContainer'); // Added container for dynamic params
const $generateBtn = $('#generateBtn');
const $improveBtn = $('#improvePrompt');
const $gallery = $('#imageGallery');
const $pagination = $('#galleryPagination');
const $spinner = $('#spinnerOverlay');
const errorModal = new bootstrap.Modal('#errorModal');
const deleteModal = new bootstrap.Modal('#deleteModal'); // Ensure delete modal is initialized
const $imageModal = $('#imageModal');
const $modalImage = $('#modalImage');
const $modalNavPrev = $('.modal-nav-prev');
const $modalNavNext = $('.modal-nav-next');
// Load saved form state
// Load only prompt and selected model from state
function loadFormState() {
    const savedState = localStorage.getItem(STORAGE_KEY);
    let selectedModel = null;
    if (savedState) {
        const state = JSON.parse(savedState);
        $prompt.val(state.prompt || '');
        selectedModel = state.model || null; // Get saved model ID
    }
    return selectedModel; // Return the saved model ID to be selected after models load
}

// Save form state
// Save only prompt and selected model
function saveFormState() {
    const state = {
        prompt: $prompt.val(),
        model: $modelSelect.val() // Save selected model ID
    };
    // Only save if a model is actually selected
    if (state.model) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
}

// Show error in modal
function showError(message) {
    $('#errorMessage').text(message);
    errorModal.show();
}

// Toggle loading state with optional text
function toggleLoading(show, text = '') { // Added text parameter
    const $spinnerText = $('#spinner-text'); // Get the text element
    if (show) {
        $spinnerText.text(text); // Set the text
        $spinner.css('display', 'flex');
        $generateBtn.prop('disabled', true);
        $improveBtn.prop('disabled', true); // Disable improve button too
        isGenerating = true;
    } else {
        $spinnerText.text(''); // Clear the text
        $spinner.css('display', 'none');
        $generateBtn.prop('disabled', false);
        $improveBtn.prop('disabled', false); // Re-enable improve button
        isGenerating = false;
    }
}

// Create image card
function createImageCard(image) {
    return `
        <div class="col-md-4 col-lg-3 mb-4">
            <div class="card image-card">
                <div class="ambient-background" style="background-image: url('/images/${image.image_filename}')"></div>
                <img src="/images/${image.image_filename}" class="card-img-top" alt="Generated image">
                <div class="overlay">
                    <div class="d-flex justify-content-between">
                        <button class="btn btn-sm btn-outline-light copy-settings" data-image-id="${image.image_filename}" title="Kopírovat nastavení">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-light download-image" data-image-path="/images/${image.image_filename}" title="Stáhnout obrázek">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-image" data-image-id="${image.image_filename}" title="Smazat obrázek">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Create pagination
function createPagination(totalPages) {
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
async function loadGallery(page = 1) {
    try {
        const response = await fetch(`/api/images?page=${page}`);
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error);
        
        $gallery.empty();
        data.images.forEach(image => {
            $gallery.append(createImageCard(image));
        });
        
        currentPage = page;
        $pagination.html(createPagination(data.total_pages));
        
    } catch (error) {
        showError('Chyba při načítání galerie: ' + error.message);
    }
}

// --- Dynamic Parameter Form Generation ---

// Helper to create a label and description tooltip
function createLabel(paramName, schema) {
    let description = schema.description || '';
    // Add default value info if present
    if (schema.default !== undefined && schema.default !== null) {
        description += ` (Výchozí: ${schema.default})`;
    }
    const tooltip = description ? `data-bs-toggle="tooltip" data-bs-placement="top" title="${description}"` : '';
    return `<label for="param-${paramName}" class="form-label" ${tooltip}>${schema.title || paramName}</label>`;
}

// Helper to create different input types based on schema
function createFormField(paramName, schema) {
    const label = createLabel(paramName, schema);
    let inputHtml = '';
    const commonAttrs = `id="param-${paramName}" name="${paramName}" class="form-control model-param"`;

    // Skip prompt, handled separately
    // Skip any parameter whose name contains 'prompt' (case-insensitive), as it's handled by the main textarea
    if (paramName.toLowerCase().includes('prompt')) return '';

    if (schema.enum) {
        // Select dropdown
        const options = schema.enum.map(val =>
            `<option value="${val}" ${val === schema.default ? 'selected' : ''}>${val}</option>`
        ).join('');
        inputHtml = `<select ${commonAttrs.replace('form-control', 'form-select')}>${options}</select>`;
    } else if (schema.type === 'integer' || schema.type === 'number') {
        const min = schema.minimum !== undefined ? `min="${schema.minimum}"` : '';
        const max = schema.maximum !== undefined ? `max="${schema.maximum}"` : '';
        const step = schema.type === 'integer' ? 'step="1"' : (schema.multipleOf ? `step="${schema.multipleOf}"` : 'step="0.01"'); // Use 0.01 step instead of 'any' for floats unless multipleOf is specified
        // Default value handling, specifically for width/height
        let initialValue = schema.default;
        if ((paramName === 'width' || paramName === 'height') && initialValue === undefined) {
            initialValue = 1024; // Set default to 1024 if not specified
        }
        // Ensure initialValue is parsed for both attribute and display span
        const parsedInitialValue = initialValue !== undefined ? parseFloat(initialValue) : undefined;
        const defaultValueAttr = parsedInitialValue !== undefined ? `value="${parsedInitialValue}"` : '';
        // Use parsed initial value for display, fallback to parsed minimum if needed
        const displayValue = parsedInitialValue !== undefined ? parsedInitialValue : (schema.minimum !== undefined ? parseFloat(schema.minimum) : '');

        // Use range slider specifically for width/height if min/max are defined, or based on heuristic for others
        const useRange = (paramName === 'width' || paramName === 'height')
                         ? (schema.minimum !== undefined && schema.maximum !== undefined)
                         : (schema.minimum !== undefined && schema.maximum !== undefined && (schema.maximum - schema.minimum <= 1000)); // Keep heuristic for others

        if (useRange) {
            // Range slider with number display (formatted)
            inputHtml = `
                <div class="d-flex align-items-center">
                    <input type="range" ${commonAttrs} ${min} ${max} ${step} ${defaultValueAttr} style="flex-grow: 1; margin-right: 10px;">
                    <span class="range-value">${displayValue}</span>
                </div>
            `;
        } else {
            // Standard number input
            inputHtml = `<input type="number" ${commonAttrs} ${min} ${max} ${step} ${defaultValueAttr}>`;
        }
    } else if (schema.type === 'boolean') {
        // Checkbox
        const checked = schema.default === true ? 'checked' : '';
        // Use form-check structure for better layout
        inputHtml = `
            <div class="form-check">
                <input type="checkbox" ${commonAttrs.replace('form-control', 'form-check-input')} ${checked}>
                <label class="form-check-label" for="param-${paramName}">${schema.description || ''}</label>
            </div>`;
        // Return early as label is included
        return `<div class="col-md-6 mb-3">${inputHtml}</div>`;
    } else if (schema.type === 'string') {
        // Text input (could be textarea if format suggests)
        const defaultValue = schema.default !== undefined ? `value="${schema.default}"` : '';
        if (schema.format === 'textarea' || (schema.description && schema.description.toLowerCase().includes('multi-line'))) {
             inputHtml = `<textarea ${commonAttrs} rows="3">${schema.default || ''}</textarea>`;
        } else {
             inputHtml = `<input type="text" ${commonAttrs} ${defaultValue}>`;
        }
    } else {
        console.warn(`Unsupported parameter type for ${paramName}: ${schema.type}`);
        return ''; // Skip unsupported types
    }

    return `<div class="col-md-6 mb-3">${label}${inputHtml}</div>`;
}

// Generate form fields from schema and append to container
function generateFormFields(schema) {
    $modelParamsContainer.empty(); // Clear previous params
    if (!schema || !schema.properties) {
        console.error("Invalid schema received:", schema);
        $modelParamsContainer.html('<p class="text-danger">Nepodařilo se načíst parametry modelu.</p>');
        return;
    }

    let fieldsHtml = '';
    // Sort properties based on x-order before generating fields
    const sortedProperties = Object.entries(schema.properties)
        .sort(([, schemaA], [, schemaB]) => {
            const orderA = schemaA['x-order'] !== undefined ? schemaA['x-order'] : Infinity; // Put items without x-order last
            const orderB = schemaB['x-order'] !== undefined ? schemaB['x-order'] : Infinity;
            return orderA - orderB;
        });

    for (const [paramName, paramSchema] of sortedProperties) {
        fieldsHtml += createFormField(paramName, paramSchema);
    }
    $modelParamsContainer.html(fieldsHtml || '<p class="text-muted">Tento model nemá žádné další konfigurovatelné parametry.</p>');

    // Initialize tooltips for new elements
    const tooltipTriggerList = [].slice.call($modelParamsContainer[0].querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Add event listener for range sliders to update display value
    $modelParamsContainer.find('input[type="range"]').on('input', function() {
        // Update the displayed value WHEN the slider is moved (no extra formatting needed due to step)
        const currentValue = $(this).val();
        $(this).siblings('.range-value').text(currentValue);
    });
}

// Load model parameters from API
async function loadModelParams(modelId) {
    if (!modelId) {
        $modelParamsContainer.empty();
        return;
    }
    toggleLoading(true, 'Načítání parametrů...'); // Add text for loading params
    $modelParamsContainer.html('<p class="text-muted">Načítání parametrů...</p>');
    try {
        // Encode the model ID properly for the URL path
        const encodedModelId = encodeURIComponent(modelId).replace(/%2F/g, '/');
        const response = await fetch(`/api/models/${encodedModelId}`);
        const data = await response.json();

        if (!response.ok) {
            // Try to parse error from backend response, fallback to status text
            const errorMsg = data?.error || data?.message || response.statusText;
            throw new Error(`Chyba ${response.status}: ${errorMsg}`);
        }

        // The response itself should be the schema's 'components.schemas.Input' part
        generateFormFields(data?.components?.schemas?.Input);

    } catch (error) {
        console.error("Error loading model parameters:", error);
        showError(`Nepodařilo se načíst parametry pro model ${modelId}: ${error.message}`);
        $modelParamsContainer.html(`<p class="text-danger">Chyba při načítání parametrů: ${error.message}</p>`);
    } finally {
        toggleLoading(false);
    }
}

// Load models from API and populate select
async function loadModels() {
    try {
        const response = await fetch('/api/models');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Neznámá chyba');

        $modelSelect.empty().append('<option value="" disabled selected>Vyberte model...</option>'); // Clear and add placeholder
        if (data.models && data.models.length > 0) {
            data.models.forEach(modelId => {
                // Display a user-friendly name if possible (e.g., extract from ID)
                const displayName = modelId.split('/').pop().replace(/-/g, ' ').replace(/_/g, ' ');
                $modelSelect.append(`<option value="${modelId}">${displayName}</option>`);
            });
            $modelSelect.prop('disabled', false);

            // Try to select previously saved model
            const savedModel = loadFormState(); // Load prompt and get saved model ID
            if (savedModel && data.models.includes(savedModel)) {
                $modelSelect.val(savedModel);
            }

            // Trigger loading params for the initially selected model (if any)
            loadModelParams($modelSelect.val());

        } else {
            $modelSelect.append('<option value="" disabled>Žádné modely nejsou nakonfigurovány</option>');
            $modelSelect.prop('disabled', true);
        }
    } catch (error) {
        console.error("Error loading models:", error);
        showError('Nepodařilo se načíst seznam modelů: ' + error.message);
        $modelSelect.empty().append('<option value="" disabled>Chyba načítání modelů</option>').prop('disabled', true);
    }
}

// --- Modified Core Functions ---

// Generate image using dynamic parameters
async function generateImage(prompt, modelId, parameters) {
    try {
        // For generation, backend handles both translation and generation.
        // We'll show a general message.
        toggleLoading(true, 'Generuji obrázek...');

        const payload = {
            prompt: prompt,
            model_id: modelId,
            parameters: parameters
        };
        console.log("Sending generation request:", payload); // Debug log

        const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (!response.ok) {
            const errorMsg = data?.error || data?.message || `Chyba ${response.status}`;
            throw new Error(errorMsg);
        }

        // No polling needed anymore as backend waits for result (or should)
        // If backend returns immediately with job ID, polling logic would be needed here.
        // Assuming backend now returns the final result directly.
        toggleLoading(false);
        loadGallery(1); // Reload first page to show the new image

    } catch (error) {
        toggleLoading(false);
        console.error("Error generating image:", error);
        showError('Chyba při generování obrázku: ' + error.message);
    }
}

// Improve prompt
async function improvePrompt(prompt) {
    try {
        toggleLoading(true, 'Vylepšuji prompt...'); // Add text for improving prompt
        
        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        
        $prompt.val(data.improved_prompt);
        saveFormState();
        
    } catch (error) {
        showError('Chyba při vylepšování promptu: ' + error.message);
    } finally {
        toggleLoading(false);
    }
}

// Delete image
async function deleteImage(imageId) {
    try {
        const response = await fetch(`/api/image/${imageId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        
        loadGallery(currentPage);
        
    } catch (error) {
        showError('Chyba při mazání obrázku: ' + error.message);
    }
}


// --- Modal Navigation Logic ---

// Function to show specific image in modal
function showModalImage(index) {
    if (modalImages.length === 0) return; // No images to show

    // Handle index wrapping
    currentModalIndex = (index + modalImages.length) % modalImages.length;

    const imageFilename = modalImages[currentModalIndex];
    $modalImage.attr('src', `/images/${imageFilename}`);

    // Optional: Preload next/prev images for smoother transition (can be added later if needed)
}

// Function to open the image modal
function openImageModal(clickedImageSrc) {
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

    // Add keyboard listener when modal opens
    $(document).on('keydown.modalNav', handleModalKeydown);
    // Add touch listeners when modal opens
    $imageModal.on('touchstart.modalNav', handleTouchStart);
    $imageModal.on('touchmove.modalNav', handleTouchMove);
    $imageModal.on('touchend.modalNav', handleTouchEnd);
}

// Function to close the image modal
function closeImageModal() {
    $imageModal.css('display', 'none');
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
let touchStartX = 0;
let touchEndX = 0;
const swipeThreshold = 50; // Minimum distance for a swipe

function handleTouchStart(e) {
    // Prevent default scroll/zoom behavior during swipe detection
    // e.preventDefault();
    touchStartX = e.originalEvent.touches[0].clientX;
    touchEndX = 0; // Reset end coordinate on new touch start
}

function handleTouchMove(e) {
    // e.preventDefault(); // Prevent scroll while swiping
    touchEndX = e.originalEvent.touches[0].clientX;
}

function handleTouchEnd(e) {
    // e.preventDefault();
    if (touchStartX === 0 || touchEndX === 0) return; // Ensure move happened

    const deltaX = touchEndX - touchStartX;

    if (Math.abs(deltaX) > swipeThreshold) { // Detect swipe
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

// --- End Modal Navigation Logic ---

// Event Listeners
// --- Event Listeners ---

$(document).ready(() => {
    loadModels(); // Load models first, which then loads form state and initial params
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
                // Ensure numeric types are sent as numbers
                value = parseFloat($input.val());
                // Handle potential NaN if input is empty or invalid
                if (isNaN(value)) {
                   // Decide how to handle: skip, use default, or error?
                   // Skipping for now if invalid number
                   console.warn(`Invalid number value for ${name}: ${$input.val()}`);
                   return; // Skip this parameter
                }
            } else {
                value = $input.val();
            }

            // Only add parameter if it has a valid name and value
            if (name && value !== undefined && value !== null && value !== '') {
                parameters[name] = value;
            }
        });
        
        if (!prompt) {
            showError('Zadejte prompt pro generování obrázku.');
            return;
        }
        if (!modelId) {
            showError('Vyberte model pro generování.');
            return;
        }

        saveFormState(); // Save prompt and selected model
        await generateImage(prompt, modelId, parameters);
    });

    // Model selection change
    $modelSelect.on('change', function() {
        const selectedModelId = $(this).val();
        loadModelParams(selectedModelId);
        saveFormState(); // Save the newly selected model
    });
    
    // Improve prompt button
    $improveBtn.on('click', async () => {
        const prompt = $prompt.val().trim();
        if (!prompt) {
            showError('Zadejte prompt pro vylepšení');
            return;
        }
        await improvePrompt(prompt);
    });
    
    // Pagination clicks
    $pagination.on('click', '.page-link', async (e) => {
        e.preventDefault();
        const page = $(e.currentTarget).data('page');
        if (page && page !== currentPage) {
            await loadGallery(page);
        }
    });
    
    // Delete modal already initialized globally
    let imageToDelete = null;

    // Delete image button click
    $gallery.on('click', '.delete-image', (e) => {
        const imageId = $(e.currentTarget).data('image-id');
        imageToDelete = imageId.replace(/\.(webp|png)$/, '');
        deleteModal.show();
    });

    // Confirm delete button click
    $('#confirmDelete').on('click', async () => {
        if (imageToDelete) {
            await deleteImage(imageToDelete);
            deleteModal.hide();
            imageToDelete = null;
        }
    });
    
    // Copy settings (Simplified - only copies prompt and selects model)
    // TODO: Extend to set dynamic parameters after they are loaded
    $gallery.on('click', '.copy-settings', async (e) => {
        const imageId = $(e.currentTarget).data('image-id');
        const cleanImageId = imageId.replace(/\.(webp|png)$/, '');
        try {
            toggleLoading(true); // Show spinner while loading metadata and params
            const response = await fetch(`/api/metadata/${cleanImageId}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Neznámá chyba');

            // Set prompt and model
            $prompt.val(data.original_prompt || data.prompt || ''); // Use original if available
            const modelIdToSelect = data.model_id;

            if (modelIdToSelect && $modelSelect.find(`option[value="${modelIdToSelect}"]`).length) {
                $modelSelect.val(modelIdToSelect);
                // Trigger parameter loading for the selected model
                await loadModelParams(modelIdToSelect); // Wait for params to load

                // --- TODO: Apply saved parameters ---
                // This part is tricky because loadModelParams is async.
                // We need to wait for it to finish, then find the generated fields
                // and set their values based on data.parameters.
                console.log("TODO: Apply saved parameters:", data.parameters);
                // Example (needs refinement and error handling):
                if (data.parameters) {
                    for (const [paramName, paramValue] of Object.entries(data.parameters)) {
                        const $field = $modelParamsContainer.find(`[name="${paramName}"]`);
                        if ($field.length) {
                            if ($field.is(':checkbox')) {
                                $field.prop('checked', paramValue);
                            } else if ($field.is('input[type="range"]')) {
                                $field.val(paramValue);
                                $field.siblings('.range-value').text(paramValue); // Update range display
                            } else {
                                $field.val(paramValue);
                            }
                        }
                    }
                }
                // ------------------------------------

            } else {
                console.warn(`Model ${modelIdToSelect} from metadata not found in select options.`);
                // Optionally clear params or show a message
                $modelParamsContainer.empty();
            }

            saveFormState(); // Save the applied prompt and model

        } catch (error) {
            showError('Chyba při kopírování nastavení: ' + error.message);
            $modelParamsContainer.empty(); // Clear params on error
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

    // Image modal
    const $imageModal = $('#imageModal');
    const $modalImage = $('#modalImage');

    // Open image modal (with navigation)
    // Use off().on() to prevent multiple bindings if code runs again or gallery reloads
    $gallery.off('click', '.card-img-top').on('click', '.card-img-top', function(e) {
        e.stopPropagation(); // Prevent triggering overlay buttons
        const imageSrc = $(this).attr('src');
        openImageModal(imageSrc); // Use the new function to handle state and listeners
        $('body').css('overflow', 'hidden'); // Prevent scrolling while modal is open
    });

    // Modal Navigation Clicks (attach directly, not inside gallery listener)
    $modalNavPrev.off('click').on('click', (e) => {
        e.stopPropagation(); // Prevent modal close if clicking on nav area
        showModalImage(currentModalIndex - 1);
    });

    $modalNavNext.off('click').on('click', (e) => {
        e.stopPropagation(); // Prevent modal close if clicking on nav area
        showModalImage(currentModalIndex + 1);
    });

    // Close modal (background click or X button)
    $imageModal.off('click').on('click', function(e) {
        // Close if the click target is NOT inside a nav area AND NOT the close button.
        // This allows clicking the image or the background area between navs to close.
        if (!$(e.target).closest('.modal-nav').length && !$(e.target).closest('.modal-close').length) {
            closeImageModal(); // Handles removing listeners and clearing state
            $('body').css('overflow', ''); // Restore scrolling
        }
    });
    // Use off().on() for close button as well
    $('.modal-close').off('click').on('click', function(e) {
         e.stopPropagation(); // Prevent background click handler
         closeImageModal(); // Handles removing listeners and clearing state
         $('body').css('overflow', ''); // Restore scrolling
    });

    function closeImageModal() {
        $imageModal.css('display', 'none');
        $('body').css('overflow', '');
    }

    // Form input changes (only save prompt and model select on change)
    $prompt.on('change input', saveFormState);
    // Model select change is handled separately to trigger param loading

    // Update range slider display on input
    // Need to use event delegation as elements are dynamic
    $modelParamsContainer.on('input', 'input[type="range"]', function() {
        $(this).siblings('.range-value').text($(this).val());
        // Note: saveFormState is NOT called here for dynamic params currently
    });
});