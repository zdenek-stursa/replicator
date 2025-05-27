// Dynamic form generation and aspect ratio handling

import { ASPECT_RATIOS } from './constants.js';

// DOM Elements (will be initialized in main.js)
let $modelParamsContainer;

// Initialize DOM references
export function initializeFormGeneratorElements(modelParamsContainerElement) {
    $modelParamsContainer = modelParamsContainerElement;
}

// Parses "X:Y" string to a numeric ratio (X/Y)
export function parseRatio(ratioString) {
    if (!ratioString || typeof ratioString !== 'string' || !ratioString.includes(':')) {
        return 1; // Default to 1:1 if invalid
    }
    const parts = ratioString.split(':');
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    return (den !== 0 && !isNaN(num) && !isNaN(den)) ? num / den : 1;
}

// Clamps value within min/max and rounds to the nearest multipleOf
export function clampAndRound(value, min, max, multipleOf) {
    let clampedValue = value;
    if (min !== undefined && clampedValue < min) clampedValue = min;
    if (max !== undefined && clampedValue > max) clampedValue = max;
    if (multipleOf !== undefined && multipleOf > 0) {
        clampedValue = Math.round(clampedValue / multipleOf) * multipleOf;
    }
    return Math.round(clampedValue); // Return integer
}

// Helper to apply a value to a form input (handles different types)
export function applyParamValue(key, value) {
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
        const step = schema.type === 'integer' ? 'step="1"' : (schema.multipleOf ? `step="${schema.multipleOf}"` : 'step="0.01"');

        // Default value handling, specifically for width/height
        let initialValue = schema.default;
        if ((paramName === 'width' || paramName === 'height') && initialValue === undefined) {
            initialValue = 1024; // Set default to 1024 if not specified
        }

        const parsedInitialValue = initialValue !== undefined ? parseFloat(initialValue) : undefined;
        const defaultValueAttr = parsedInitialValue !== undefined ? `value="${parsedInitialValue}"` : '';
        const displayValue = parsedInitialValue !== undefined ? parsedInitialValue : (schema.minimum !== undefined ? parseFloat(schema.minimum) : '');

        // Use range slider specifically for width/height if min/max are defined, or based on heuristic for others
        const useRange = (paramName === 'width' || paramName === 'height')
                         ? (schema.minimum !== undefined && schema.maximum !== undefined)
                         : (schema.minimum !== undefined && schema.maximum !== undefined && (schema.maximum - schema.minimum <= 1000));

        if (useRange) {
            // Range slider with number display
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
        inputHtml = `
            <div class="form-check">
                <input type="checkbox" ${commonAttrs.replace('form-control', 'form-check-input')} ${checked}>
                <label class="form-check-label" for="param-${paramName}">${schema.description || ''}</label>
            </div>`;
        // Return early as label is included
        return `<div class="col-md-6 mb-3">${inputHtml}</div>`;
    } else if (schema.type === 'string') {
        // Text input
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
export function generateFormFields(schema) {
    if (!$modelParamsContainer) {
        console.warn('Form generator elements not initialized');
        return;
    }

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
        const options = ASPECT_RATIOS.map(ratio =>
            `<option value="${ratio.value}" ${ratio.selected ? 'selected' : ''}>${ratio.label}</option>`
        ).join('');

        aspectRatioHtml = `
            <div class="col-12 mb-3">
                <label for="aspectRatioSelect" class="form-label">Aspect ratio</label>
                <select id="aspectRatioSelect" class="form-select">
                    ${options}
                </select>
            </div>
        `;
    }

    let fieldsHtml = '';
    // Sort properties based on x-order before generating fields
    const sortedProperties = Object.entries(schema.properties)
        .sort(([, schemaA], [, schemaB]) => {
            const orderA = schemaA['x-order'] !== undefined ? schemaA['x-order'] : Infinity;
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
        const currentValue = $(this).val();
        $(this).siblings('.range-value').text(currentValue);
    });

    // Hide dimension inputs initially if aspect ratio selector is shown
    if (showAspectRatioSelector) {
        $modelParamsContainer.find('.dimension-input-wrapper').hide();
    }
}

// Aspect Ratio Change Handler
export function handleAspectRatioChange(schema) {
    if (!$modelParamsContainer) {
        console.warn('Form generator elements not initialized');
        return;
    }

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
