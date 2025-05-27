// API communication functions

import { showError, toggleLoading, getRandomMessage } from './ui.js';
import { GENERATE_MESSAGES, IMPROVE_MESSAGES } from './constants.js';
import { generateFormFields, handleAspectRatioChange } from './form-generator.js';
import { loadGallery, getCurrentPage } from './gallery.js';
import { saveFormState } from './storage.js';

// DOM Elements (will be initialized in main.js)
let $prompt, $modelSelect, $modelParamsContainer;

// Initialize DOM references
export function initializeAPIClientElements(promptElement, modelSelectElement, modelParamsContainerElement) {
    $prompt = promptElement;
    $modelSelect = modelSelectElement;
    $modelParamsContainer = modelParamsContainerElement;
}

// Load models from API and populate select
export async function loadModels() {
    if (!$modelSelect) {
        console.warn('Model select element not initialized');
        return null;
    }
    
    try {
        const response = await fetch('/api/models');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unknown error');

        $modelSelect.empty().append('<option value="" disabled selected>Select model...</option>');
        if (data.models && data.models.length > 0) {
            data.models.forEach(modelId => {
                // Display a user-friendly name if possible
                const displayName = modelId.split('/').pop().replace(/-/g, ' ').replace(/_/g, ' ');
                $modelSelect.append(`<option value="${modelId}">${displayName}</option>`);
            });
            $modelSelect.prop('disabled', false);
            return data.models;
        } else {
            $modelSelect.append('<option value="" disabled>No models configured</option>');
            $modelSelect.prop('disabled', true);
            return [];
        }
    } catch (error) {
        console.error("Error loading models:", error);
        showError('Failed to load model list: ' + error.message);
        $modelSelect.empty().append('<option value="" disabled>Error loading models</option>').prop('disabled', true);
        return null;
    }
}

// Load model parameters from API
export async function loadModelParams(modelId) {
    if (!modelId || !$modelParamsContainer) {
        if ($modelParamsContainer) {
            $modelParamsContainer.empty();
        }
        return;
    }
    
    toggleLoading(true, 'Loading parameters...');
    $modelParamsContainer.html('<p class="text-muted">Loading parameters...</p>');
    
    try {
        // Encode the model ID properly for the URL path
        const encodedModelId = encodeURIComponent(modelId).replace(/%2F/g, '/');
        const response = await fetch(`/api/models/${encodedModelId}`);
        const data = await response.json();

        if (!response.ok) {
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

// Generate image using dynamic parameters
export async function generateImage(prompt, modelId, parameters) {
    try {
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

        console.log("Sending generation request:", payload);

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

        toggleLoading(false);
        loadGallery(1); // Reload first page to show the new image

    } catch (error) {
        toggleLoading(false);
        console.error("Error generating image:", error);
        showError('Error generating image: ' + error.message);
    }
}

// Improve prompt
export async function improvePrompt(prompt) {
    if (!$prompt) {
        console.warn('Prompt element not initialized');
        return;
    }
    
    try {
        toggleLoading(true, getRandomMessage(IMPROVE_MESSAGES));

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
export async function deleteImage(imageId) {
    try {
        const response = await fetch(`/api/image/${imageId}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        loadGallery(getCurrentPage());

    } catch (error) {
        showError('Error deleting image: ' + error.message);
    }
}
