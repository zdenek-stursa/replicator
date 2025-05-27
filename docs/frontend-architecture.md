# Frontend Architecture

## Overview

The Replicator frontend has been refactored from a monolithic 1000+ line JavaScript file into a modular ES6 architecture. This improves maintainability, testability, and code organization.

## Module Structure

### Core Modules

#### `constants.js`
- Application-wide constants and configuration
- Loading messages for different operations
- Aspect ratio definitions
- Touch navigation thresholds

```javascript
export const GENERATE_MESSAGES = [
    "Sacrificing my soul...",
    "Crunching pixels...",
    // ...
];
```

#### `storage.js`
- localStorage management
- Form state persistence
- DOM element initialization for storage operations

```javascript
export function saveFormState() {
    // Saves prompt and selected model to localStorage
}
```

#### `ui.js`
- User interface utilities
- Error handling and display
- Loading state management
- Random message generation

```javascript
export function showError(message) {
    // Displays error in modal with proper formatting
}
```

#### `gallery.js`
- Image gallery management
- Pagination handling
- Image card creation
- Gallery state management

```javascript
export function loadGallery(page = 1) {
    // Loads and displays gallery images
}
```

#### `form-generator.js`
- Dynamic form field generation
- Aspect ratio handling
- Parameter validation and application
- Schema-based form creation

```javascript
export function generateFormFields(schema) {
    // Creates form fields based on model schema
}
```

#### `api-client.js`
- API communication layer
- Model loading and parameter fetching
- Image generation requests
- Prompt improvement functionality

```javascript
export async function generateImage(prompt, modelId, parameters) {
    // Handles image generation API calls
}
```

#### `modal-navigation.js`
- Image modal functionality
- Keyboard and touch navigation
- Swipe gesture detection
- Modal state management

```javascript
export function openImageModal(imageSrc) {
    // Opens image in modal with navigation
}
```

#### `main.js`
- Application initialization
- Module coordination
- Event listener setup
- DOM element management

## Initialization Flow

1. **Module Import**: All required modules are imported using ES6 syntax
2. **DOM Ready**: jQuery document ready event triggers initialization
3. **Module Setup**: Each module is initialized with required DOM elements
4. **Data Loading**: Models and gallery are loaded from API
5. **Event Binding**: All event listeners are attached
6. **State Restoration**: Previous form state is restored from localStorage

## Communication Between Modules

Modules communicate through:
- **Exported functions**: Public API for each module
- **Initialization functions**: Pass DOM elements to modules
- **Event system**: jQuery events for loose coupling
- **Shared state**: Minimal global state in main.js

## Benefits of Modular Architecture

### Maintainability
- Each module has a single responsibility
- Easier to locate and fix bugs
- Clearer code organization

### Testability
- Modules can be tested in isolation
- Easier to mock dependencies
- Better test coverage possible

### Reusability
- Modules can be imported independently
- Functions can be reused across different contexts
- Easier to extract common functionality

### Scalability
- New features can be added as separate modules
- Existing modules can be extended without affecting others
- Better separation of concerns

## Development Guidelines

### Adding New Functionality

1. Determine which module the functionality belongs to
2. If it doesn't fit existing modules, create a new one
3. Export only necessary functions
4. Initialize with required DOM elements
5. Update main.js to import and initialize the new module

### Module Dependencies

- Modules should minimize dependencies on other modules
- Use initialization functions to pass required elements
- Prefer function parameters over global state
- Import only what you need

### Error Handling

- Use the `showError` function from `ui.js` for user-facing errors
- Log detailed errors to console for debugging
- Handle async operations with try-catch blocks
- Provide meaningful error messages

## Migration Notes

The refactoring maintained 100% backward compatibility:
- All existing functionality preserved
- Same API endpoints and data flow
- Identical user interface and behavior
- No breaking changes to HTML structure

## Future Improvements

- Add TypeScript for better type safety
- Implement unit tests for each module
- Add JSDoc documentation
- Consider using a build system for optimization
- Implement lazy loading for better performance
