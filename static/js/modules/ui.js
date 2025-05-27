// UI utility functions

// DOM Elements (will be initialized in main.js)
let $spinner, $generateBtn, $improveBtn, $clearBtn, errorModal;

// Initialize DOM references
export function initializeUIElements(spinnerElement, generateBtnElement, improveBtnElement, clearBtnElement, errorModalElement) {
    $spinner = spinnerElement;
    $generateBtn = generateBtnElement;
    $improveBtn = improveBtnElement;
    $clearBtn = clearBtnElement;
    errorModal = errorModalElement;
}

// Helper function to get a random message
export function getRandomMessage(messagesArray) {
    const randomIndex = Math.floor(Math.random() * messagesArray.length);
    return messagesArray[randomIndex];
}

// Show error in modal
export function showError(message) {
    if (!errorModal) {
        console.error('Error modal not initialized:', message);
        return;
    }

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
export function toggleLoading(show, text = '') {
    if (!$spinner || !$generateBtn || !$improveBtn || !$clearBtn) {
        console.warn('UI elements not initialized');
        return;
    }

    const $spinnerText = $('#spinner-text'); // Get the text element
    if (show) {
        $spinnerText.text(text); // Set the text
        $spinner.css('display', 'flex');
        $generateBtn.prop('disabled', true);
        $improveBtn.prop('disabled', true); // Disable improve button too
        $clearBtn.prop('disabled', true); // Disable clear button too
    } else {
        $spinnerText.text(''); // Clear the text
        $spinner.css('display', 'none');
        $generateBtn.prop('disabled', false);
        $improveBtn.prop('disabled', false); // Re-enable improve button
        $clearBtn.prop('disabled', false); // Re-enable clear button
    }
}

// Set global generating state
export function setGeneratingState(generating) {
    if (typeof window !== 'undefined') {
        window.isGenerating = generating;
    }
}
