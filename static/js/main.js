// Form state management
const STORAGE_KEY = 'replicate-ai-form';
let currentPage = 1;
let isGenerating = false;
let modalImages = []; // Array to store image filenames for modal navigation
let currentModalIndex = -1; // Index of the currently displayed image in the modal

// --- Loading Messages ---
const GENERATE_MESSAGES = [
    "Sacrificing my soul...",
    "Crunching pixels...",
    "Hold on...",
    "Materializing beauty...",
    "One pixel, two pixels, ...",
    "Rearranging 0s and 1s...",
    "Kneading...",
    "Casting spells...",
    "Chaooos...",
    "Polishing...",
    "Heating up the GPUs...",
    "Meditating...",
    "Sublimating dreams...",
    "Munching...",
    "Crushing...",
    "Making coffee...",
    "Exploring the universe...",
    "Quantifying the cosmos...",
    "Assembling...",
    "Can't go any slower..."
];

const IMPROVE_MESSAGES = [
    "Time to write...",
    "Copywriters, now!",
    "I choose you...",
    "Less talk, more rewrite...",
    "Here I gooo!",
    "Ugh, work...",
    "You didn't exactly shine...",
    "So-called author...",
    "More nonsense...",
    "Reaaally?",
    "Seriously?",
    "Damn, why?",
    "No, not this!",
    "I really can't do this..."
];

// Helper function to get a random message
function getRandomMessage(messagesArray) {
    const randomIndex = Math.floor(Math.random() * messagesArray.length);
    return messagesArray[randomIndex];
}

// --- Aspect Ratio Helpers ---

// Parses "X:Y" string to a numeric ratio (X/Y)
function parseRatio(ratioString) {
    if (!ratioString || typeof ratioString !== 'string' || !ratioString.includes(':')) {
        return 1; // Default to 1:1 if invalid
    }
    const parts = ratioString.split(':');
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    return (den !== 0 && !isNaN(num) && !isNaN(den)) ? num / den : 1;
}

// Clamps value within min/max and rounds to the nearest multipleOf
function clampAndRound(value, min, max, multipleOf) {
    let clampedValue = value;
    if (min !== undefined && clampedValue < min) clampedValue = min;
    if (max !== undefined && clampedValue > max) clampedValue = max;
    if (multipleOf !== undefined && multipleOf > 0) {
        clampedValue = Math.round(clampedValue / multipleOf) * multipleOf;
    }
    return Math.round(clampedValue); // Return integer
}

// Helper to apply a value to a form input (handles different types)
function applyParamValue(key, value) {
    const $input = $(`#param-${key}`);
    if ($input.length && value !== undefined && value !== null) {
        if ($input.is(':checkbox')) {
            $input.prop('checked', value === true || value === 'true');
        } else if ($input.is('select')) {
            $input.val(value);
        } else if ($input.attr('type') === 'range') {
            $input.val(value);
            $input.siblings('.range-value').text(value); // Update range display
        } else {
            $input.val(value);
        }
    }
}


// DOM Elements
const $form = $('#generationForm');
const $prompt = $('#prompt');
const $modelSelect = $('#modelSelect'); // Changed ID
const $modelParamsContainer = $('#modelParamsContainer'); // Added container for dynamic params
const $generateBtn = $('#generateBtn');
const $improveBtn = $('#improvePrompt');
const $clearBtn = $('#clearPrompt');
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
    const $errorHelp = $('#errorHelp');

    // Check if the message contains API Configuration Error
    if (message.includes('API Configuration Error')) {
        // Format the message for better readability
        const formattedMessage = message
            .replace('API Configuration Error: ', '<strong>Configuration Error:</strong><br>')
            .replace('OpenAI API key is missing or invalid', '<span class="text-danger">OpenAI API key is missing or invalid</span>');

        $('#errorMessage').html(formattedMessage);

        // Show troubleshooting help for API configuration errors
        $errorHelp.removeClass('d-none');
    } else {
        // For other errors, just use text
        $('#errorMessage').text(message);

        // Hide troubleshooting help for other errors
        $errorHelp.addClass('d-none');
    }

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
        $clearBtn.prop('disabled', true); // Disable clear button too
        isGenerating = true;
    } else {
        $spinnerText.text(''); // Clear the text
        $spinner.css('display', 'none');
        $generateBtn.prop('disabled', false);
        $improveBtn.prop('disabled', false); // Re-enable improve button
        $clearBtn.prop('disabled', false); // Re-enable clear button
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
        showError('Error loading gallery: ' + error.message);
    }
}

// --- Dynamic Parameter Form Generation ---

// Helper to create a label and description tooltip
function createLabel(paramName, schema) {
    let description = schema.description || '';
    // Add default value info if present
    if (schema.default !== undefined && schema.default !== null) {
        description += ` (Default: ${schema.default})`;
    }
    const tooltip = description ? `data-bs-toggle="tooltip" data-bs-placement="top" title="${description}"` : '';
    return `<label for="param-${paramName}" class="form-label" ${tooltip}>${schema.title || paramName}</label>`;
}

// Helper to create different input types based on schema
function createFormField(paramName, schema) {
    const label = createLabel(paramName, schema);
    let inputHtml = '';
    let wrapperClass = 'col-md-6 mb-3'; // Default wrapper class
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

    // Add specific class for width/height wrappers to allow hiding/showing
    if (paramName === 'width' || paramName === 'height') {
        wrapperClass += ' dimension-input-wrapper';
    }

    return `<div class="${wrapperClass}">${label}${inputHtml}</div>`;
}

// Generate form fields from schema and append to container
function generateFormFields(schema) {
    $modelParamsContainer.empty(); // Clear previous params
    if (!schema || !schema.properties) {
        console.error("Invalid schema received:", schema);
        $modelParamsContainer.html('<p class="text-danger">Failed to load model parameters.</p>');
        return;
    }

    // Check if both width and height are present for aspect ratio selector
    const hasWidth = schema.properties.hasOwnProperty('width');
    const hasHeight = schema.properties.hasOwnProperty('height');
    const showAspectRatioSelector = hasWidth && hasHeight;

    let aspectRatioHtml = '';
    if (showAspectRatioSelector) {
        aspectRatioHtml = `
            <div class="col-12 mb-3">
                <label for="aspectRatioSelect" class="form-label">Aspect ratio</label>
                <select id="aspectRatioSelect" class="form-select">
                    <option value="21:9">21:9 (Cinematic)</option>
                    <option value="16:9">16:9 (Widescreen)</option>
                    <option value="3:2">3:2</option>
                    <option value="4:3">4:3</option>
                    <option value="5:4">5:4</option>
                    <option value="1:1" selected>1:1 (Square)</option>
                    <option value="4:5">4:5 (Portrait)</option>
                    <option value="3:4">3:4 (Portrait)</option>
                    <option value="2:3">2:3 (Portrait)</option>
                    <option value="9:16">9:16 (Tall/Story)</option>
                    <option value="9:21">9:21 (Tall Cinematic)</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
        `;
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
    $modelParamsContainer.html(aspectRatioHtml + fieldsHtml || '<p class="text-muted">This model has no additional configurable parameters.</p>');

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

    // Hide dimension inputs initially if aspect ratio selector is shown
    if (showAspectRatioSelector) {
        $modelParamsContainer.find('.dimension-input-wrapper').hide();
    }
}

// --- Aspect Ratio Change Handler ---
function handleAspectRatioChange(schema) {
    const selectedRatio = $('#aspectRatioSelect').val();
    const $widthInput = $('#param-width');
    const $heightInput = $('#param-height');
    const $dimensionWrappers = $modelParamsContainer.find('.dimension-input-wrapper');

    if (!$widthInput.length || !$heightInput.length || !schema || !schema.properties) {
        console.error("Missing elements or schema for aspect ratio handling.");
        return;
    }

    const widthSchema = schema.properties.width || {};
    const heightSchema = schema.properties.height || {};

    if (selectedRatio === 'custom') {
        $dimensionWrappers.slideDown(); // Show width/height inputs
    } else {
        $dimensionWrappers.slideUp(); // Hide width/height inputs

        const ratioValue = parseRatio(selectedRatio); // Get numeric ratio W/H

        // Get max dimensions from schema, with fallbacks
        const maxWidth = widthSchema.maximum || widthSchema.default || 1024;
        const maxHeight = heightSchema.maximum || heightSchema.default || 1024;

        let calculatedWidth, calculatedHeight;

        // Calculate dimensions based on orientation
        if (ratioValue >= 1) { // Landscape or Square
            calculatedWidth = maxWidth;
            calculatedHeight = maxWidth / ratioValue;
        } else { // Portrait
            calculatedHeight = maxHeight;
            calculatedWidth = maxHeight * ratioValue;
        }

        // Clamp and round based on schema constraints for BOTH dimensions
        calculatedWidth = clampAndRound(calculatedWidth, widthSchema.minimum, widthSchema.maximum, widthSchema.multipleOf);
        calculatedHeight = clampAndRound(calculatedHeight, heightSchema.minimum, heightSchema.maximum, heightSchema.multipleOf);

        // Update the hidden input values
        $widthInput.val(calculatedWidth);
        $heightInput.val(calculatedHeight);

        // If sliders are used, update their display values too (even though hidden)
        if ($widthInput.attr('type') === 'range') {
            $widthInput.siblings('.range-value').text(calculatedWidth);
        }
        if ($heightInput.attr('type') === 'range') {
            $heightInput.siblings('.range-value').text(calculatedHeight);
        }
    }
}

// Load model parameters from API
async function loadModelParams(modelId) {
    if (!modelId) {
        $modelParamsContainer.empty();
        return;
    }
    toggleLoading(true, 'Loading parameters...'); // Add text for loading params
    $modelParamsContainer.html('<p class="text-muted">Loading parameters...</p>');
    try {
        // Encode the model ID properly for the URL path
        const encodedModelId = encodeURIComponent(modelId).replace(/%2F/g, '/');
        const response = await fetch(`/api/models/${encodedModelId}`);
        const data = await response.json();

        if (!response.ok) {
            // Try to parse error from backend response, fallback to status text
            const errorMsg = data?.error || data?.message || response.statusText;
            throw new Error(`Error ${response.status}: ${errorMsg}`);
        }

        // The response itself should be the schema's 'components.schemas.Input' part
        const inputSchema = data?.components?.schemas?.Input;
        generateFormFields(inputSchema);

        // If aspect ratio selector was added, attach listener and trigger initial calculation
        if ($('#aspectRatioSelect').length > 0 && inputSchema) {
            $modelParamsContainer.off('change', '#aspectRatioSelect').on('change', '#aspectRatioSelect', () => handleAspectRatioChange(inputSchema));
            handleAspectRatioChange(inputSchema); // Initial calculation for default ratio
        }

    } catch (error) {
        console.error("Error loading model parameters:", error);
        showError(`Failed to load parameters for model ${modelId}: ${error.message}`);
        $modelParamsContainer.html(`<p class="text-danger">Error loading parameters: ${error.message}</p>`);
    } finally {
        toggleLoading(false);
    }
}

// Load models from API and populate select
async function loadModels() {
    try {
        const response = await fetch('/api/models');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unknown error');

        $modelSelect.empty().append('<option value="" disabled selected>Select model...</option>'); // Clear and add placeholder
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
            $modelSelect.append('<option value="" disabled>No models configured</option>');
            $modelSelect.prop('disabled', true);
        }
    } catch (error) {
        console.error("Error loading models:", error);
        showError('Failed to load model list: ' + error.message);
        $modelSelect.empty().append('<option value="" disabled>Error loading models</option>').prop('disabled', true);
    }
}

// --- Modified Core Functions ---

// Generate image using dynamic parameters
async function generateImage(prompt, modelId, parameters) {
    try {
        // For generation, backend handles both translation and generation.
        // We'll show a general message.
        toggleLoading(true, getRandomMessage(GENERATE_MESSAGES));

        const payload = {
            prompt: prompt,
            model_id: modelId,
            parameters: parameters
        };
        // Add aspect_ratio: "custom" if width and height are being sent
        if (payload.parameters.hasOwnProperty('width') && payload.parameters.hasOwnProperty('height')) {
             payload.parameters.aspect_ratio = "custom";
        }

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
            const errorMsg = data?.error || data?.message || `Error ${response.status}`;
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
        showError('Error generating image: ' + error.message);
    }
}

// Improve prompt
async function improvePrompt(prompt) {
    try {
        toggleLoading(true, getRandomMessage(IMPROVE_MESSAGES)); // Use random message

        const response = await fetch('/api/improve-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        if (!response.ok) {
            // Handle different error types
            if (response.status === 401 && data.type === 'ConfigurationError') {
                throw new Error('API Configuration Error: ' + data.message);
            } else {
                throw new Error(data.error || data.message || 'Unknown error');
            }
        }

        $prompt.val(data.improved_prompt);
        saveFormState();

    } catch (error) {
        console.error("Error improving prompt:", error);
        showError('Error improving prompt: ' + error.message);
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
        showError('Error deleting image: ' + error.message);
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
    $('body').css('overflow', 'hidden'); // Hide body scrollbars

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
            showError('Please enter a prompt to generate an image.');
            return;
        }
        if (!modelId) {
            showError('Please select a model for generation.');
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
            showError('Please enter a prompt to improve.');
            return;
        }
        await improvePrompt(prompt);
    });

    // Clear prompt button
    $clearBtn.on('click', () => {
        $prompt.val(''); // Clear the textarea content
        saveFormState(); // Save the empty state
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

            if (!response.ok) throw new Error(data.error || 'Unknown error');

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
                    const parameters = data.parameters || {};
                    for (const [key, value] of Object.entries(parameters)) {
                         // Skip width/height for now, handle them via aspect ratio logic
                         if (key === 'width' || key === 'height') continue;
                         applyParamValue(key, value); // Use helper function
                    }

                    // --- Aspect Ratio Handling ---
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
                                    // Compare with tolerance for floating point issues
                                    if (Math.abs(actualRatio - optionRatio) < 0.01) {
                                        $aspectSelect.val(optionVal);
                                        matched = true;
                                        return false; // Break loop
                                    }
                                }
                            });
                            if (!matched) {
                                $aspectSelect.val('custom');
                            }
                        } else {
                            $aspectSelect.val('custom'); // Fallback if width/height invalid
                        }
                        // Trigger change handler to update UI (show/hide sliders etc.)
                        // and apply the loaded width/height values correctly
                        $aspectSelect.trigger('change');

                        // Ensure the actual width/height from metadata are set AFTER triggering change
                        // This handles the 'custom' case correctly and overrides potential recalculations
                        applyParamValue('width', metaWidth);
                        applyParamValue('height', metaHeight);

                    } else {
                         // If no aspect ratio selector, apply width/height directly if they exist
                         applyParamValue('width', parameters.width);
                         applyParamValue('height', parameters.height);
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
            showError('Error copying settings: ' + error.message);
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