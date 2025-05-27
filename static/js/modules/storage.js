// Form state management and localStorage utilities

import { STORAGE_KEY } from './constants.js';

// DOM Elements (will be initialized in main.js)
let $prompt, $modelSelect;

// Initialize DOM references
export function initializeStorageElements(promptElement, modelSelectElement) {
    $prompt = promptElement;
    $modelSelect = modelSelectElement;
}

// Load only prompt and selected model from state
export function loadFormState() {
    const savedState = localStorage.getItem(STORAGE_KEY);
    let selectedModel = null;
    if (savedState) {
        const state = JSON.parse(savedState);
        if ($prompt) {
            $prompt.val(state.prompt || '');
        }
        selectedModel = state.model || null; // Get saved model ID
    }
    return selectedModel; // Return the saved model ID to be selected after models load
}

// Save only prompt and selected model
export function saveFormState() {
    if (!$prompt || !$modelSelect) {
        console.warn('Storage elements not initialized');
        return;
    }
    
    const state = {
        prompt: $prompt.val(),
        model: $modelSelect.val() // Save selected model ID
    };
    // Only save if a model is actually selected
    if (state.model) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
}
